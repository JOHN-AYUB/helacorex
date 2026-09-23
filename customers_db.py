"""
Helacore Customers Database Module
SQLite-based customer storage with CRUD operations and analytics.
"""
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "helacore_customers.db")


class CustomersDB:
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self):
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT DEFAULT '',
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT DEFAULT '',
                    phone TEXT DEFAULT '',
                    country TEXT DEFAULT '',
                    city TEXT DEFAULT '',
                    location TEXT DEFAULT '',
                    segment TEXT DEFAULT 'New',
                    total_orders INTEGER DEFAULT 0,
                    total_spent REAL DEFAULT 0.0,
                    price REAL DEFAULT 0.0,
                    orders_description TEXT DEFAULT '',
                    customer_type TEXT DEFAULT 'new',
                    status TEXT DEFAULT 'active',
                    last_purchase TEXT DEFAULT '',
                    created_at TEXT DEFAULT '',
                    latitude REAL,
                    longitude REAL,
                    notes TEXT DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS customer_segments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    color TEXT DEFAULT '#10b981',
                    criteria TEXT DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS customer_activity_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER,
                    action TEXT DEFAULT '',
                    details TEXT DEFAULT '',
                    timestamp TEXT DEFAULT '',
                    FOREIGN KEY (customer_id) REFERENCES customers(id)
                );
            """)
            # Seed default segments
            cur = conn.execute("SELECT COUNT(*) FROM customer_segments")
            if cur.fetchone()[0] == 0:
                segments = [
                    ("New Customers", "#10b981", "First purchase within 30 days"),
                    ("Loyal Customers", "#06b6d4", "Repeat purchases, high frequency"),
                    ("Potential Loyal", "#f59e0b", "Growing engagement, mid-tier"),
                    ("At Risk", "#f59e0b", "Declining activity, high value"),
                    ("Lost / Inactive", "#ef4444", "No purchase in 60+ days"),
                ]
                conn.executemany("INSERT INTO customer_segments (name, color, criteria) VALUES (?, ?, ?)", segments)

    # ─── CRUD Operations ───────────────────────────────────────────────

    def add_customer(self, data: Dict[str, Any]) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        fields = [
            data.get("first_name", ""), data.get("last_name", ""),
            data.get("email", ""), data.get("phone", ""),
            data.get("country", ""), data.get("city", ""),
            data.get("location", data.get("city", "")),
            data.get("segment", "New"),
            int(data.get("total_orders", 0)), float(data.get("total_spent", 0)),
            float(data.get("price", 0)), data.get("orders_description", ""),
            data.get("customer_type", "new"), data.get("status", "active"),
            data.get("last_purchase", ""), now,
            data.get("latitude"), data.get("longitude"), data.get("notes", ""),
        ]
        with self._get_conn() as conn:
            cur = conn.execute("""
                INSERT INTO customers (
                    user_id, first_name, last_name, email, phone, country, city, location,
                    segment, total_orders, total_spent, price, orders_description,
                    customer_type, status, last_purchase, created_at, latitude, longitude, notes
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, ("", *fields))
            cid = cur.lastrowid
            conn.execute(
                "INSERT INTO customer_activity_log (customer_id, action, details, timestamp) VALUES (?,?,?,?)",
                (cid, "created", f"Customer {data.get('first_name','')} {data.get('last_name','')} added", now)
            )
        return self.get_customer(cid)

    def update_customer(self, customer_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        sets, vals = [], []
        allowed = ["first_name","last_name","email","phone","country","city","location",
                   "segment","total_orders","total_spent","price","orders_description",
                   "customer_type","status","last_purchase","latitude","longitude","notes"]
        for k in allowed:
            if k in data:
                sets.append(f"{k} = ?")
                vals.append(data[k])
        if not sets:
            return self.get_customer(customer_id)
        vals.append(customer_id)
        with self._get_conn() as conn:
            conn.execute(f"UPDATE customers SET {','.join(sets)} WHERE id = ?", vals)
            conn.execute(
                "INSERT INTO customer_activity_log (customer_id, action, details, timestamp) VALUES (?,?,?,?)",
                (customer_id, "updated", "Customer record updated", datetime.now().isoformat())
            )
        return self.get_customer(customer_id)

    def delete_customer(self, customer_id: int) -> bool:
        with self._get_conn() as conn:
            conn.execute("DELETE FROM customer_activity_log WHERE customer_id = ?", (customer_id,))
            conn.execute("DELETE FROM customers WHERE id = ?", (customer_id,))
        return True

    def get_customer(self, customer_id: int) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute("SELECT * FROM customers WHERE id = ?", (customer_id,)).fetchone()
        return dict(row) if row else None

    def get_customers(self, user_id: str = "", page: int = 1, per_page: int = 10,
                      search: str = "", segment: str = "", status: str = "",
                      sort: str = "last_purchase", sort_dir: str = "desc") -> Dict[str, Any]:
        offset = (page - 1) * per_page
        where = []
        params = []
        if user_id:
            where.append("user_id = ?")
            params.append(user_id)
        if search:
            where.append("(first_name || ' ' || last_name || ' ' || email || ' ' || phone || ' ' || city || ' ' || country) LIKE ?")
            params.append(f"%{search}%")
        if segment:
            where.append("segment = ?")
            params.append(segment)
        if status:
            where.append("status = ?")
            params.append(status)
        where_clause = f"WHERE {' AND '.join(where)}" if where else ""
        total = conn_count = 0
        with self._get_conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM customers {where_clause}", params).fetchone()[0]
            sort_dir_sql = "ASC" if sort_dir == "asc" else "DESC"
            query = f"""
                SELECT *,
                    CASE WHEN julianday(?) - julianday(last_purchase) <= 7 THEN 'Today'
                         WHEN julianday(?) - julianday(last_purchase) <= 1 THEN 'Yesterday'
                         WHEN julianday(?) - julianday(last_purchase) < 7 THEN CAST(ROUND(julianday(?) - julianday(last_purchase)) AS TEXT) || ' days ago'
                         WHEN julianday(?) - julianday(last_purchase) < 30 THEN CAST(ROUND((julianday(?) - julianday(last_purchase))/7) AS TEXT) || ' weeks ago'
                         ELSE strftime('%b %d', last_purchase) END AS last_order_display,
                    CASE WHEN julianday(?) - julianday(last_purchase) > 60 THEN 'inactive'
                         WHEN julianday(?) - julianday(last_purchase) > 30 THEN 'at_risk'
                         WHEN julianday(?) - julianday(last_purchase) <= 7 THEN 'active_recent'
                         ELSE 'active' END AS churn_status
                FROM customers {where_clause}
                ORDER BY {sort} {sort_dir_sql}
                LIMIT ? OFFSET ?
            """
            p = [datetime.now().isoformat()] * 7 + params + [per_page, offset]
            rows = conn.execute(query, p).fetchall()
            conn_count = conn.execute(f"SELECT COUNT(*) FROM customers WHERE segment='New' {where_clause}", params).fetchone()[0]
            returning_count = conn.execute(f"SELECT COUNT(*) FROM customers WHERE customer_type='returning' {where_clause}", params).fetchone()[0]
        customers = [dict(r) for r in rows]
        return {
            "customers": customers,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total + per_page - 1) // per_page),
            "new_count": conn_count,
            "returning_count": returning_count,
        }

    def get_stats(self, user_id: str = "") -> Dict[str, Any]:
        where = ["user_id = ?"] if user_id else []
        params = [user_id] if user_id else []
        with self._get_conn() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM customers {'WHERE ' + ' AND '.join(where)}", params).fetchone()[0]
            now = datetime.now()
            month_ago = (now - timedelta(days=30)).isoformat()
            new_count = conn.execute(
                f"SELECT COUNT(*) FROM customers {'WHERE ' + ' AND '.join(where)} AND created_at >= ?",
                params + [month_ago]
            ).fetchone()[0]
            returning_count = conn.execute(
                f"SELECT COUNT(*) FROM customers {'WHERE ' + ' AND '.join(where)} AND customer_type = 'returning'"
                + (" AND created_at >= ?" if not where else ""),
                params + [month_ago] if not where else params
            ).fetchone()[0]
            active = conn.execute(
                f"SELECT COUNT(*) FROM customers {'WHERE ' + ' AND '.join(where)} AND status = 'active'"
                + (" AND created_at >= ?" if not where else ""),
                params + [month_ago] if not where else params
            ).fetchone()[0]
            churned = conn.execute(
                f"SELECT COUNT(*) FROM customers {'WHERE ' + ' AND '.join(where)} AND status = 'inactive'"
                + (" AND created_at >= ?" if not where else ""),
                params + [month_ago] if not where else params
            ).fetchone()[0]
            total_spent = conn.execute(
                f"SELECT COALESCE(SUM(total_spent), 0) FROM customers {'WHERE ' + ' AND '.join(where)}", params
            ).fetchone()[0]
            avg_clv = conn.execute(
                f"SELECT CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(total_spent), 0) / COUNT(*) ELSE 0 END FROM customers {'WHERE ' + ' AND '.join(where)}",
                params
            ).fetchone()[0]
            avg_order_value = conn.execute(
                f"SELECT CASE WHEN SUM(total_orders) > 0 THEN COALESCE(SUM(total_spent), 0) / SUM(total_orders) ELSE 0 END FROM customers {'WHERE ' + ' AND '.join(where)}",
                params
            ).fetchone()[0]
        return {
            "total_customers": total, "new_customers": new_count,
            "returning_customers": returning_count, "active": active,
            "churned": churned, "total_spent": total_spent,
            "avg_clv": round(avg_clv, 2), "avg_order_value": round(avg_order_value, 2),
        }

    def get_growth_data(self, period: str = "month", user_id: str = "") -> Dict[str, Any]:
        where = ["user_id = ?"] if user_id else []
        params = [user_id] if user_id else []
        with self._get_conn() as conn:
            if period == "month":
                query = """
                    SELECT strftime('%Y-%m', created_at) as month,
                        SUM(CASE WHEN customer_type = 'new' THEN 1 ELSE 0 END) as new_customers,
                        SUM(CASE WHEN customer_type = 'returning' THEN 1 ELSE 0 END) as returning_customers,
                        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as churned
                    FROM customers WHERE created_at >= date('now', '-6 months') {' AND ' + ' AND '.join(where) if where else ''}
                    GROUP BY strftime('%Y-%m', created_at) ORDER BY month
                """
                rows = conn.execute(query, params).fetchall()
            else:
                query = """
                    SELECT strftime('%Y-%m', created_at) as month,
                        SUM(CASE WHEN customer_type = 'new' THEN 1 ELSE 0 END) as new_customers,
                        SUM(CASE WHEN customer_type = 'returning' THEN 1 ELSE 0 END) as returning_customers,
                        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as churned
                    FROM customers GROUP BY strftime('%Y-%m', created_at) ORDER BY month
                """
                rows = conn.execute(query, params).fetchall()
            return {
                "labels": [r["month"] for r in rows],
                "new": [r["new_customers"] for r in rows],
                "returning": [r["returning_customers"] for r in rows],
                "churned": [r["churned"] for r in rows],
            }

    def get_segmentation_data(self) -> Dict[str, Any]:
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT
                    CASE
                        WHEN customer_type = 'new' AND status = 'active' THEN 'New'
                        WHEN customer_type = 'returning' AND status = 'active' AND julianday(?) - julianday(last_purchase) <= 30 THEN 'Loyal'
                        WHEN customer_type = 'returning' AND julianday(?) - julianday(last_purchase) <= 60 THEN 'Potential Loyal'
                        WHEN customer_type = 'returning' AND julianday(?) - julianday(last_purchase) > 60 THEN 'At Risk'
                        WHEN status = 'inactive' THEN 'Lost/Inactive'
                        ELSE 'New'
                    END as segment_group,
                    COUNT(*) as count
                FROM customers, (SELECT datetime('now') as now)
                GROUP BY segment_group
            """).fetchall()
        result = {}
        total = sum(r["count"] for r in rows)
        color_map = {"New": "#10b981", "Loyal": "#06b6d4", "Potential Loyal": "#f59e0b", "At Risk": "#f59e0b", "Lost/Inactive": "#ef4444"}
        for r in rows:
            seg = r["segment_group"]
            result[seg] = {"count": r["count"], "color": color_map.get(seg, "#71717a"), "pct": round(r["count"] / max(total, 1) * 100, 1)}
        return result

    def get_locations(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT city || ', ' || country as location, city, country, COUNT(*) as count,
                       AVG(total_spent) as avg_spent, AVG(latitude) as lat, AVG(longitude) as lng
                FROM customers WHERE city != '' AND city IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
                GROUP BY city, country ORDER BY count DESC LIMIT 20
            """).fetchall()
            return [dict(r) for r in rows]

    def get_locations_simple(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute("""
                SELECT city || ', ' || country as location, city, country, COUNT(*) as count
                FROM customers WHERE city != '' AND city IS NOT NULL
                GROUP BY city, country ORDER BY count DESC LIMIT 20
            """).fetchall()
            return [dict(r) for r in rows]

    def get_churn_analysis(self) -> Dict[str, Any]:
        now = datetime.now()
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
            churned = conn.execute("SELECT COUNT(*) FROM customers WHERE status = 'inactive'").fetchone()[0]
            at_risk = conn.execute("""
                SELECT COUNT(*) FROM customers WHERE status = 'active'
                AND julianday(?) - julianday(last_purchase) > 30
            """, (now.isoformat(),)).fetchone()[0]
            loyal = conn.execute("""
                SELECT COUNT(*) FROM customers WHERE status = 'active'
                AND julianday(?) - julianday(last_purchase) <= 30
            """, (now.isoformat(),)).fetchone()[0]
            churn_rate = round((churned / max(total, 1)) * 100, 1)
            retention_rate = round((loyal / max(total, 1)) * 100, 1)
            return {
                "total": total, "churned": churned, "at_risk": at_risk,
                "loyal": loyal, "churn_rate": churn_rate,
                "retention_rate": retention_rate,
                "churn_trend": "down" if churn_rate < 5 else "up",
            }

    def get_clv_data(self) -> Dict[str, Any]:
        with self._get_conn() as conn:
            avg_clv = conn.execute("SELECT COALESCE(AVG(total_spent), 0) FROM customers").fetchone()[0]
            by_segment = conn.execute("""
                SELECT segment, COUNT(*) as cnt, COALESCE(AVG(total_spent), 0) as avg_spent
                FROM customers GROUP BY segment
            """).fetchall()
        segments = {}
        for r in by_segment:
            segments[r["segment"]] = {"count": r["cnt"], "avg_clv": round(r["avg_spent"], 2)}
        return {"avg_clv": round(avg_clv, 2), "by_segment": segments}

    def export_customers(self, user_id: str = "", format: str = "csv") -> str:
        data = self.get_customers(user_id=user_id, per_page=10000)
        customers = data["customers"]
        if format == "csv":
            import csv, io
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["Name", "Email", "Phone", "Country", "City", "Segment",
                             "Total Orders", "Total Spent", "Last Order", "Status", "Type"])
            for c in customers:
                writer.writerow([
                    f"{c.get('first_name','')} {c.get('last_name','')}", c.get("email",""),
                    c.get("phone",""), c.get("country",""), c.get("city",""),
                    c.get("segment",""), c.get("total_orders",""), c.get("total_spent",""),
                    c.get("last_purchase",""), c.get("status",""), c.get("customer_type","")
                ])
            return output.getvalue()
        return ""

    def get_quick_actions_data(self) -> Dict[str, Any]:
        stats = self.get_stats()
        churn = self.get_churn_analysis()
        clv = self.get_clv_data()
        growth = self.get_growth_data(period="month")
        seg = self.get_segmentation_data()
        return {
            "stats": stats, "churn": churn, "clv": clv,
            "growth": growth, "segmentation": seg,
            "total_customers": stats["total_customers"],
            "new_this_month": stats["new_customers"],
            "churn_risk_count": churn["at_risk"] + churn["churned"],
        }


if __name__ == "__main__":
    db = CustomersDB()
    print("✅ Helacore Customers DB initialized")
    print(f"📍 Database: {DB_PATH}")
    db.add_customer({
        "first_name": "Grace", "last_name": "Muthoni",
        "email": "grace@example.com", "phone": "+254 712 345 678",
        "country": "Kenya", "city": "Nairobi", "segment": "VIP",
        "total_orders": 5, "total_spent": 25000, "price": 5000,
        "customer_type": "returning", "status": "active",
        "last_purchase": "2026-05-28"
    })
    print("✅ Sample customer added")
    stats = db.get_stats()
    print(f"📊 Stats: {stats}")