# 🚀 START HERE - Helacore AI Advisor Model Upgrade

## The Problem
Your local model (SmolLM2-135M) produces **poor quality output** like:
```
Diagnosis: Measuresyoost Career Recommendation
Actions: []
```

## The Solution
Upgrade to **Phi-1.5** (1.5B parameters, better quality, no auth required).

---

## ✅ Just Run These 3 Commands

```bash
# 1. Download Phi-1.5 model
cd "helacore (3)"
python download_model.py --model phi1_5

# 2. Fine-tune it (takes ~60-90 minutes)
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-1_5 \
    --dataset /tmp/helacore_mega_dataset.jsonl \
    --generate-subset \
    --subset-size 1000 \
    --output checkpoints/phi1_5_finetuned \
    --epochs 3 \
    --device cpu

# 3. Update configuration
# Edit ai_advisor/core/local_model.py and change:
#   base_model: str = "microsoft/phi-1_5"
#   adapter_path: str | Path = "checkpoints/phi1_5_finetuned"
```

---

## 🎯 What You'll Get

**Before:**
```
Diagnosis: Measuresyoost Career Recommendation
Actions: []
```

**After:**
```
Diagnosis: The business is a retail shop in Nairobi with KSh 500,000 monthly 
revenue. Gross margin is 40% and net margin is 4%. High inventory (600K) and 
receivables (400K) are tying up cash. Cash on hand (100K) covers less than one 
month of expenses (480K), creating liquidity risk.

Actions:
  1. Review cash flow to understand position
  2. Reduce inventory to free up cash
  3. Collect receivables faster

Cautions: This is decision support only. Business has risk flags: high 
inventory, high receivables, low liquidity.
```

---

## 📖 Need More Details?

- **Full Guide**: See `MODEL_RETRAINING_GUIDE.md`
- **Step-by-Step**: See `NEXT_STEPS.md`
- **Checklist**: See `CHECKLIST.md`
- **Troubleshooting**: See `MODEL_DOWNLOAD_STATUS.md`

---

## ⏱️ Time Required

| Step | Time | What Happens |
|------|------|--------------|
| 1. Download | 10-20 min | Downloads ~3.3GB model |
| 2. Fine-tune | 60-90 min | Trains on your data (unattended) |
| 3. Configure | 2 min | Update 2 lines of code |
| **Total** | **~75-115 min** | **Mostly unattended** |

---

## 🎉 You're Done When...

✅ New model produces coherent, grounded business advice  
✅ Offline analysis works without API key  
✅ Output follows Helacore format (diagnosis, actions, cautions)  

---

## 💡 Tips

- **Start small**: Try with `--subset-size 100` and `--epochs 1` first to test
- **Monitor**: Use `top` or `htop` to check CPU usage during training
- **Space**: Ensure you have ~10GB free disk space
- **Patience**: Training takes time on CPU, but it's worth it!

---

## 🚀 Ready?

Run this now:
```bash
cd "helacore (3)"
python download_model.py --model phi1_5
```

Then follow the 3 commands above.

---

*That's it! Everything else is already set up for you.*
