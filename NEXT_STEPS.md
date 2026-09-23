# 🎯 Next Steps for Helacore AI Advisor Model Retraining

## ✅ What's Ready

### ML Environment
- **Python 3.13 venv** at `/tmp/helacore_ml_venv` with all dependencies:
  - torch 2.13.0 (CPU)
  - transformers 5.16.1
  - datasets 5.0.1
  - peft 0.20.0
  - accelerate 1.14.0

### Training Infrastructure
1. **Training Script**: `ai_advisor/training/local_finetune_tinyllama.py`
   - Supports TinyLlama-1.1B, Phi-2, Phi-1.5, and other models
   - Automatic dataset preparation
   - LoRA fine-tuning
   - CPU/GPU compatible

2. **Download Script**: `download_model.py`
   - Downloads multiple model options
   - Handles authentication
   - Progress feedback

3. **Configuration**: `ai_advisor/config/model_config.yaml`
   - Central model settings
   - Easy to switch between models

### Existing Assets
- **Fine-tuned SmolLM2-135M**: Already working at `checkpoints/local_model/`
- **Training Data**: Prepared datasets at `checkpoints/checkpoints/finetune_data/`
- **Mega Dataset**: 100K records at `/tmp/helacore_mega_dataset.jsonl`

---

## 🚀 Immediate Next Steps

### Step 1: Download a Better Model (Choose One)

#### Option A: Phi-1.5 (Recommended - Best Balance)
```bash
cd "helacore (3)"
python download_model.py --model phi1_5
```
- **Size**: ~3.3GB
- **Params**: 1.5B
- **Auth**: Not required
- **Quality**: ⭐⭐⭐⭐
- **Speed**: ⭐⭐⭐⭐

#### Option B: Phi-2 (Best Quality)
```bash
cd "helacore (3)"
timeout 3600 python download_model.py --model phi2
```
- **Size**: ~5.4GB
- **Params**: 2.7B
- **Auth**: Not required
- **Quality**: ⭐⭐⭐⭐⭐
- **Speed**: ⭐⭐⭐
- **Note**: Partial download already in cache (~1.5GB)

#### Option C: TinyLlama-1.1B (Requires Auth)
```bash
cd "helacore (3)"
# Get token from https://huggingface.co/settings/tokens
export HF_TOKEN=your_token_here
python download_model.py --model tinyllama
```
- **Size**: ~2.2GB
- **Params**: 1.1B
- **Auth**: Required
- **Quality**: ⭐⭐⭐⭐
- **Speed**: ⭐⭐⭐⭐

---

### Step 2: Prepare Training Data

Once model is downloaded, generate a balanced training subset:

```bash
cd "helacore (3)"
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-1_5 \  # or microsoft/phi-2 or TinyLlama/TinyLlama-1.1B
    --dataset /tmp/helacore_mega_dataset.jsonl \
    --generate-subset \
    --subset-size 1000 \
    --output checkpoints/phi1_5_data
```

This will create:
- `checkpoints/phi1_5_data/train_subset.jsonl` (800 records)
- `checkpoints/phi1_5_data/val_subset.jsonl` (200 records)
- `checkpoints/phi1_5_data/train_subset_formatted.jsonl` (chat format)
- `checkpoints/phi1_5_data/val_subset_formatted.jsonl` (chat format)

---

### Step 3: Fine-Tune the Model

```bash
cd "helacore (3)"
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-1_5 \  # Match the model you downloaded
    --train checkpoints/phi1_5_data/train_subset_formatted.jsonl \
    --val checkpoints/phi1_5_data/val_subset_formatted.jsonl \
    --output checkpoints/phi1_5_finetuned \
    --epochs 3 \
    --batch-size 2 \
    --grad-accum 2 \
    --lr 2e-4 \
    --lora-r 16 \
    --lora-alpha 32 \
    --device cpu
```

**Expected Time**: ~60-90 minutes on 4-core CPU

---

### Step 4: Test the Fine-Tuned Model

```bash
cd "helacore (3)"
python -c "
import asyncio
import sys
sys.path.insert(0, '.')

from ai_advisor.core.engine import HelacoreReasoningEngine
from ai_advisor.models.conversation import AdvisorRequest

async def test():
    engine = HelacoreReasoningEngine()
    
    # Test case 1: Cash flow problem
    req1 = AdvisorRequest(
        message='Why am I short on cash despite growing sales?',
        context_override={'business': {
            'type': 'retail shop', 'county': 'Nairobi', 'country': 'Kenya',
            'revenue_monthly_ksh': 500000, 'expenses_monthly_ksh': 480000,
            'cogs_monthly_ksh': 300000, 'gross_profit_monthly_ksh': 200000,
            'net_profit_monthly_ksh': 20000, 'cash_ksh': 100000,
            'inventory_ksh': 600000, 'receivables_ksh': 400000,
            'debt_ksh': 900000, 'customers': 500
        }}
    )
    resp1 = await engine.analyze(req1)
    print('=== Test 1: Cash Flow ===')
    print(f'Model: {resp1.model_used}')
    print(f'Diagnosis: {resp1.diagnosis.summary[:150]}...')
    print(f'Actions: {len(resp1.actions)}')
    print()
    
    # Test case 2: Profitability
    req2 = AdvisorRequest(
        message='How can I improve my profit margins?',
        context_override={'business': {
            'type': 'restaurant', 'county': 'Kisumu', 'country': 'Kenya',
            'revenue_monthly_ksh': 800000, 'expenses_monthly_ksh': 750000,
            'cogs_monthly_ksh': 600000, 'gross_profit_monthly_ksh': 200000,
            'net_profit_monthly_ksh': -50000, 'cash_ksh': 150000,
            'inventory_ksh': 200000, 'receivables_ksh': 100000,
            'debt_ksh': 500000, 'customers': 300
        }}
    )
    resp2 = await engine.analyze(req2)
    print('=== Test 2: Profitability ===')
    print(f'Model: {resp2.model_used}')
    print(f'Diagnosis: {resp2.diagnosis.summary[:150]}...')
    print(f'Actions: {len(resp2.actions)}')

asyncio.run(test())
"
```

---

### Step 5: Update Configuration

Edit `ai_advisor/core/local_model.py` to use the new model:

```python
class LocalModel:
    def __init__(
        self,
        base_model: str = "microsoft/phi-1_5",  # Changed from SmolLM2-135M
        adapter_path: str | Path = "checkpoints/phi1_5_finetuned",  # Changed
        max_new_tokens: int = 300,
        temperature: float = 0.3,
        top_p: float = 0.9,
        device: str = "cpu",
    ) -> None:
```

---

## 📊 Quality Checklist

After fine-tuning, verify the model produces:

- [ ] **Coherent text**: No gibberish or hallucinated words
- [ ] **Proper format**: JSON structure with diagnosis, actions, cautions
- [ ] **Grounded advice**: Recommendations based on actual financial data
- [ ] **Relevant actions**: 3-5 actionable recommendations per problem
- [ ] **Safety**: Appropriate cautions and limitations
- [ ] **Domain knowledge**: Understands business terminology

---

## ⏱️ Time Estimates

| Task | Time | Notes |
|------|------|-------|
| Download Phi-1.5 | 10-20 min | Depends on internet |
| Generate training data | 1-2 min | Fast |
| Fine-tune Phi-1.5 (3 epochs) | 60-90 min | On 4-core CPU |
| Test model | 1-2 min | Quick validation |
| **Total** | **~75-115 min** | **One-time setup** |

---

## 🎯 Expected Improvements

### Current (SmolLM2-135M):
```
Diagnosis: Measuresyoost Career Recommendation
Actions: []
Cautions: []
```

### After (Phi-1.5 Fine-Tuned):
```
Diagnosis: The business is a retail shop in Nairobi, Kenya with KSh 500,000 
monthly revenue. Gross margin is 40.0% and net margin is 4.0%. The main concerns 
are high inventory relative to revenue (600K vs 500K monthly revenue) and high 
receivables (400K), which are tying up cash. Cash on hand (100K) covers less than 
one month of expenses (480K), creating liquidity risk.

Actions:
  1. [immediate] Review cash flow: Analyze the last 3-6 months of cash inflows 
     and outflows to understand the cash position
  2. [short_term] Reduce inventory: Lower inventory levels to free up cash
  3. [short_term] Collect receivables: Implement stricter credit control and 
     faster collection processes

Cautions:
  - This analysis was generated from the provided financial data using 
    deterministic calculations. It is decision support only.
  - The business has active risk flags requiring attention: high inventory, 
    high receivables, low liquidity.
```

---

## 💡 Tips for Success

### 1. Start Small
```bash
# Test with just 100 records and 1 epoch first
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-1_5 \
    --generate-subset \
    --subset-size 100 \
    --epochs 1
```

### 2. Monitor Progress
- Check GPU/CPU usage: `top` or `htop`
- Monitor disk space: `df -h`
- Check model output quality after each epoch

### 3. Iterate
- If quality is poor, increase dataset size (2000-5000 records)
- If training is slow, reduce batch size or use gradient accumulation
- If memory issues, use smaller model or reduce sequence length

---

## 📚 Documentation

- **Full Guide**: `MODEL_RETRAINING_GUIDE.md`
- **Download Status**: `MODEL_DOWNLOAD_STATUS.md`
- **Training Script**: `ai_advisor/training/local_finetune_tinyllama.py`
- **Model Config**: `ai_advisor/config/model_config.yaml`

---

## 🎉 Success Criteria

You're done when:
1. ✅ New model is downloaded
2. ✅ Model is fine-tuned on Helacore data
3. ✅ Model produces coherent, grounded responses
4. ✅ Configuration is updated to use new model
5. ✅ Offline analysis works without API key

---

## 🚀 Ready to Start?

Run this command now:
```bash
cd "helacore (3)"
python download_model.py --model phi1_5
```

Then proceed to Step 2-5 above.

---

*Good luck! The Helacore AI Advisor will be significantly improved with a better model.* 🚀
