#!/usr/bin/env python3
"""
Helacore Synthetic User Data Importer v2.0
Handles 400,000+ users with Business Challenges and Background Challenges.
Generates SQL, JSON, and training data for the complete intelligence system.
"""

import csv
import os
import sys
import json
import random
from datetime import datetime, timedelta
from collections import Counter

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

try:
    from business_intelligence import BUSINESS_PROFILES, LOCATION_PROFILES, get_business_profile, get_location_profile
    print("✅ Business Intelligence loaded")
except ImportError:
    print("❌ Could not import business_intelligence module")
    sys.exit(1)

try:
    from challenge_intelligence import BUSINESS_CHALLENGES, BACKGROUND_CHALLENGES, get_combined_challenge_profile
    print("✅ Challenge Intelligence loaded")
except ImportError:
    print("❌ Could not import challenge_intelligence module")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════════════
# ENRICHMENT DATA
# Maps business types to realistic financial profiles
# ═══════════════════════════════════════════════════════════════════════════

def generate_financial_profile(business_type: str, location: str) -> dict:
    """Generate realistic financial data based on business type and location."""
    profile = get_business_profile(business_type)
    loc = get_location_profile(location)

    # Base revenue from profile
    base_revenue = profile["revenue_range"]["avg"]

    # Location adjustment
    rent_mult = loc.get("avg_rent_multiplier", 0.5)
    location_factor = 0.7 + (rent_mult * 0.6)  # Scale revenue by location tier

    # Add some randomness
    revenue = base_revenue * location_factor * random.uniform(0.8, 1.2)
    margin = profile["typical_margins"]["avg"] / 100 * random.uniform(0.85, 1.15)
    expenses = revenue * (1 - margin)

    # Staff based on revenue
    rev_per_emp = profile.get("benchmark_revenue_per_employee", 50000)
    staff = max(1, int(revenue / rev_per_emp * random.uniform(0.7, 1.3)))

    # Challenges from profile
    challenges = profile.get("challenges", ["Cash flow management"])
    selected_challenge = random.choice(challenges[:3])

    # Goals from profile
    goals_data = profile.get("recommended_goals", [])

    return {
        "monthly_revenue_target": round(revenue),
        "yearly_revenue_target": round(revenue * 12),
        "monthly_revenue_actual": round(revenue * random.uniform(0.85, 1.1)),
        "monthly_expenses": round(expenses),
        "profit_margin": round(margin * 100, 1),
        "staff_count": staff,
        "biggest_challenge": selected_challenge,
        "funding_status": random.choice(["Bootstrapped", "Bootstrapped", "Bootstrapped", "SACCO", "Angel Investor"]),
        "business_stage": random.choice(["Startup", "Growth", "Growth", "Established", "Established"]),
        "suggested_goals": goals_data[:3],
    }


def map_priority(priority_str: str) -> int:
    """Map priority string to numeric value."""
    mapping = {"Critical": 1, "High": 2, "Medium": 3, "Growth": 4}
    return mapping.get(priority_str, 3)


def import_users_from_csv(csv_path: str, limit: int = None):
    """Import synthetic users from CSV file (v2.0 — supports 400K+ users with challenges)."""
    users = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if limit and i >= limit:
                break

            business_type = row['Business_Type']
            location = row['Location']
            name = row['User_Name']
            business_name = row['Business_Name']
            industry = row['Business_Category']
            goal = row['Primary_Goal']
            module = row['Helacore_Module']
            priority = row['Priority']
            decision = row['Example_Decision']

            # NEW: Business and Background challenges
            business_challenge = row.get('Business_Challenge', '')
            background_challenge = row.get('Background_Challenge', '')

            # Generate enriched profile
            financial = generate_financial_profile(business_type, location)
            bi_profile = get_business_profile(business_type)
            loc_profile = get_location_profile(location)

            # Get combined challenge profile
            challenge_profile = {}
            if business_challenge and background_challenge:
                challenge_profile = get_combined_challenge_profile(business_challenge, background_challenge)

            user = {
                "user_id": row['User_ID'],
                "user_name": name,
                "business_name": business_name,
                "business_type": business_type,
                "industry": industry,
                "category": bi_profile.get("category", industry),
                "location": location,
                "tier": loc_profile.get("tier", 3),

                # Financial profile
                "monthly_revenue_target": financial["monthly_revenue_target"],
                "yearly_revenue_target": financial["yearly_revenue_target"],
                "monthly_revenue_actual": financial["monthly_revenue_actual"],
                "monthly_expenses": financial["monthly_expenses"],
                "profit_margin": financial["profit_margin"],
                "staff_count": financial["staff_count"],

                # Business context
                "biggest_challenge": financial["biggest_challenge"],
                "primary_goal": goal,
                "helacore_module": module,
                "priority": priority,
                "priority_numeric": map_priority(priority),
                "example_decision": decision,

                # NEW: Challenge data
                "business_challenge": business_challenge,
                "background_challenge": background_challenge,
                "challenge_severity": challenge_profile.get("severity", "medium"),
                "challenge_category": challenge_profile.get("category", "General"),
                "challenge_quick_win": challenge_profile.get("quick_win", ""),
                "challenge_timeline": challenge_profile.get("timeline", ""),
                "challenge_modules": challenge_profile.get("module_priority", [])[:3],
                "challenge_kpis": challenge_profile.get("kpi_focus", [])[:3],

                # Intelligence
                "business_stage": financial["business_stage"],
                "funding_status": financial["funding_status"],
                "benchmark_revenue": bi_profile["revenue_range"]["avg"],
                "benchmark_margin": bi_profile["typical_margins"]["avg"],
                "top_costs": bi_profile.get("top_costs", []),
                "seasonal_peaks": bi_profile.get("seasonal_peaks", []),
                "coaching_style": bi_profile.get("coaching_style", "general"),
                "suggested_goals": financial["suggested_goals"],

                # Location intelligence
                "competition_level": loc_profile.get("competition_level", "medium"),
                "market_access": loc_profile.get("market_access", "medium"),
                "cost_of_living": loc_profile.get("cost_of_living", "medium"),

                # Metadata
                "imported_at": datetime.utcnow().isoformat(),
                "data_source": "synthetic_v2",
            }
            users.append(user)

    return users


def generate_supabase_sql(users: list, output_path: str):
    """Generate SQL insert statements for Supabase."""
    lines = []
    lines.append("-- Helacore Synthetic User Data Import")
    lines.append(f"-- Generated: {datetime.utcnow().isoformat()}")
    lines.append(f"-- Total users: {len(users)}")
    lines.append("")

    # Create import table
    lines.append("""
-- Create import table for synthetic users (v2.0 — with challenges)
CREATE TABLE IF NOT EXISTS synthetic_users (
    id TEXT PRIMARY KEY,
    user_name TEXT,
    business_name TEXT,
    business_type TEXT,
    industry TEXT,
    category TEXT,
    location TEXT,
    tier INTEGER,
    monthly_revenue_target NUMERIC,
    yearly_revenue_target NUMERIC,
    monthly_revenue_actual NUMERIC,
    monthly_expenses NUMERIC,
    profit_margin NUMERIC,
    staff_count INTEGER,
    biggest_challenge TEXT,
    primary_goal TEXT,
    helacore_module TEXT,
    priority TEXT,
    priority_numeric INTEGER,
    example_decision TEXT,
    -- NEW: Challenge columns
    business_challenge TEXT,
    background_challenge TEXT,
    challenge_severity TEXT,
    challenge_category TEXT,
    challenge_quick_win TEXT,
    challenge_timeline TEXT,
    challenge_modules JSONB,
    challenge_kpis JSONB,
    -- Intelligence columns
    business_stage TEXT,
    funding_status TEXT,
    benchmark_revenue NUMERIC,
    benchmark_margin NUMERIC,
    top_costs JSONB,
    seasonal_peaks JSONB,
    coaching_style TEXT,
    suggested_goals JSONB,
    competition_level TEXT,
    market_access TEXT,
    cost_of_living TEXT,
    imported_at TIMESTAMPTZ,
    data_source TEXT
);

-- Enable RLS
ALTER TABLE synthetic_users ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Users can view synthetic data" ON synthetic_users
    FOR SELECT USING (true);

-- Create indexes for fast queries
CREATE INDEX idx_synthetic_users_business_type ON synthetic_users(business_type);
CREATE INDEX idx_synthetic_users_location ON synthetic_users(location);
CREATE INDEX idx_synthetic_users_business_challenge ON synthetic_users(business_challenge);
CREATE INDEX idx_synthetic_users_background_challenge ON synthetic_users(background_challenge);
CREATE INDEX idx_synthetic_users_priority ON synthetic_users(priority);
CREATE INDEX idx_synthetic_users_industry ON synthetic_users(industry);

""")

    # Generate INSERT statements in batches of 100
    for batch_start in range(0, len(users), 100):
        batch = users[batch_start:batch_start + 100]
        values = []
        for u in batch:
            top_costs_json = json.dumps(u["top_costs"]).replace("'", "''")
            seasonal_json = json.dumps(u["seasonal_peaks"]).replace("'", "''")
            goals_json = json.dumps(u["suggested_goals"]).replace("'", "''")
            challenge_modules_json = json.dumps(u.get("challenge_modules", [])).replace("'", "''")
            challenge_kpis_json = json.dumps(u.get("challenge_kpis", [])).replace("'", "''")

            val = f"""('{u['user_id']}', '{u['user_name'].replace("'", "''")}', '{u['business_name'].replace("'", "''")}', '{u['business_type'].replace("'", "''")}', '{u['industry'].replace("'", "''")}', '{u['category'].replace("'", "''")}', '{u['location'].replace("'", "''")}', {u['tier']}, {u['monthly_revenue_target']}, {u['yearly_revenue_target']}, {u['monthly_revenue_actual']}, {u['monthly_expenses']}, {u['profit_margin']}, {u['staff_count']}, '{u['biggest_challenge'].replace("'", "''")}', '{u['primary_goal'].replace("'", "''")}', '{u['helacore_module'].replace("'", "''")}', '{u['priority']}', {u['priority_numeric']}, '{u['example_decision'].replace("'", "''")}', '{u.get('business_challenge', '').replace("'", "''")}', '{u.get('background_challenge', '').replace("'", "''")}', '{u.get('challenge_severity', 'medium')}', '{u.get('challenge_category', 'General')}', '{u.get('challenge_quick_win', '').replace("'", "''")}', '{u.get('challenge_timeline', '').replace("'", "''")}', '{challenge_modules_json}', '{challenge_kpis_json}', '{u['business_stage']}', '{u['funding_status']}', {u['benchmark_revenue']}, {u['benchmark_margin']}, '{top_costs_json}', '{seasonal_json}', '{u['coaching_style']}', '{goals_json}', '{u['competition_level']}', '{u['market_access']}', '{u['cost_of_living']}', '{u['imported_at']}', '{u['data_source']}')"""
            values.append(val)

        lines.append(f"INSERT INTO synthetic_users (id, user_name, business_name, business_type, industry, category, location, tier, monthly_revenue_target, yearly_revenue_target, monthly_revenue_actual, monthly_expenses, profit_margin, staff_count, biggest_challenge, primary_goal, helacore_module, priority, priority_numeric, example_decision, business_challenge, background_challenge, challenge_severity, challenge_category, challenge_quick_win, challenge_timeline, challenge_modules, challenge_kpis, business_stage, funding_status, benchmark_revenue, benchmark_margin, top_costs, seasonal_peaks, coaching_style, suggested_goals, competition_level, market_access, cost_of_living, imported_at, data_source) VALUES")
        lines.append(",\n".join(values) + ";")
        lines.append("")

    with open(output_path, 'w') as f:
        f.write('\n'.join(lines))

    return len(users)


def generate_json_export(users: list, output_path: str):
    """Generate JSON export for frontend consumption."""
    export = {
        "metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "total_users": len(users),
            "business_types": len(set(u["business_type"] for u in users)),
            "locations": len(set(u["location"] for u in users)),
            "industries": len(set(u["industry"] for u in users)),
        },
        "users": users,
        "analytics": {
            "by_business_type": {},
            "by_location": {},
            "by_industry": {},
            "by_priority": {},
        }
    }

    # Generate analytics
    for u in users:
        bt = u["business_type"]
        loc = u["location"]
        ind = u["industry"]
        pri = u["priority"]

        export["analytics"]["by_business_type"][bt] = export["analytics"]["by_business_type"].get(bt, 0) + 1
        export["analytics"]["by_location"][loc] = export["analytics"]["by_location"].get(loc, 0) + 1
        export["analytics"]["by_industry"][ind] = export["analytics"]["by_industry"].get(ind, 0) + 1
        export["analytics"]["by_priority"][pri] = export["analytics"]["by_priority"].get(pri, 0) + 1

    with open(output_path, 'w') as f:
        json.dump(export, f, indent=2)

    return len(users)


def generate_training_data(users: list, output_path: str):
    """Generate AI training data from user profiles."""
    training = []

    for u in users:
        # Generate training examples for goal coaching
        for goal in u.get("suggested_goals", []):
            training.append({
                "business_type": u["business_type"],
                "industry": u["industry"],
                "location": u["location"],
                "challenge": u["biggest_challenge"],
                "goal": goal.get("title", ""),
                "goal_category": goal.get("category", ""),
                "coaching_style": u["coaching_style"],
                "priority": u["priority"],
                "revenue_range": u.get("benchmark_revenue", 100000),
                "context": f"A {u['business_type']} in {u['location']} with {u['biggest_challenge']}",
                "expected_advice_category": goal.get("category", "General"),
            })

        # Generate decision-making examples
        training.append({
            "business_type": u["business_type"],
            "industry": u["industry"],
            "location": u["location"],
            "decision": u["example_decision"],
            "revenue": u.get("monthly_revenue_target", 100000),
            "profit_margin": u.get("profit_margin", 20),
            "staff_count": u.get("staff_count", 2),
            "context": f"Monthly revenue KES {u.get('monthly_revenue_target', 0):,}, {u.get('staff_count', 0)} staff",
        })

    with open(output_path, 'w') as f:
        json.dump(training, f, indent=2)

    return len(training)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Import Helacore synthetic user data")
    parser.add_argument("--csv", required=True, help="Path to CSV file")
    parser.add_argument("--limit", type=int, default=None, help="Max users to import")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    parser.add_argument("--format", choices=["sql", "json", "both"], default="both", help="Output format")

    args = parser.parse_args()

    print(f"\n📊 Helacore Synthetic User Data Importer")
    print(f"{'='*50}")

    # Import users
    print(f"\n1️⃣ Importing users from {args.csv}...")
    users = import_users_from_csv(args.csv, limit=args.limit)
    print(f"   ✅ Loaded {len(users)} users")

    # Summary
    business_types = set(u["business_type"] for u in users)
    locations = set(u["location"] for u in users)
    industries = set(u["industry"] for u in users)
    print(f"   📊 Business Types: {len(business_types)}")
    print(f"   📍 Locations: {len(locations)}")
    print(f"   🏭 Industries: {len(industries)}")

    # Generate SQL
    if args.format in ("sql", "both"):
        sql_path = os.path.join(args.output_dir, "synthetic_users_import.sql")
        count = generate_supabase_sql(users, sql_path)
        print(f"\n2️⃣ Generated SQL: {sql_path}")
        print(f"   📝 {count} user records in SQL")

    # Generate JSON
    if args.format in ("json", "both"):
        json_path = os.path.join(args.output_dir, "synthetic_users.json")
        count = generate_json_export(users, json_path)
        print(f"\n3️⃣ Generated JSON: {json_path}")
        print(f"   📝 {count} user records in JSON")

    # Generate training data
    training_path = os.path.join(args.output_dir, "training_data.json")
    count = generate_training_data(users, training_path)
    print(f"\n4️⃣ Generated Training Data: {training_path}")
    print(f"   📝 {count} training examples")

    # Business type distribution
    print(f"\n📊 Business Type Distribution:")
    from collections import Counter
    for bt, count in Counter(u["business_type"] for u in users).most_common(10):
        print(f"   {count:4d}  {bt}")

    print(f"\n✅ Import complete!")
    print(f"{'='*50}")
