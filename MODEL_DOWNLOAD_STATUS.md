# Model Download Status for Helacore AI Advisor

## 📋 Summary

I've set up a complete workflow for downloading and fine-tuning better models for the Helacore AI Advisor. Here's the current status:

---

## ✅ Completed Setup

### 1. ML Environment
- **Location**: `/tmp/helacore_ml_venv`
- **Python**: 3.13.9
- **Packages Installed**:
  - `torch` 2.13.0 (CPU)
  - `transformers` 5.16.1
  - `datasets` 5.0.1
  - `peft` 0.20.0
  - `accelerate` 1.14.0
  - `huggingface-hub` 1.29.0

### 2. Training Script
- **File**: `ai_advisor/training/local_finetune_tinyllama.py`
- **Features**:
  - Supports TinyLlama-1.1B, Phi-2, Phi-1.5, and other models
  - Automatic dataset subset generation
  - Chat format conversion
  - LoRA fine-tuning
  - CPU/GPU compatible

### 3. Download Script
- **File**: `download_model.py`
- **Features**:
  - Downloads multiple model options
  - Handles authentication
  - Progress feedback
  - Configurable output directory

### 4. Configuration
- **File**: `ai_advisor/config/model_config.yaml`
- **Purpose**: Central configuration for model settings

---

## 🎯 Recommended Models

| Model | Size | Params | Auth Required | Quality | Speed | Recommendation |
|-------|------|--------|---------------|---------|-------|----------------|
| `phi-2` | ~5.4GB | 2.7B | ❌ No | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | **Best Quality** |
| `phi-1_5` | ~3.3GB | 1.5B | ❌ No | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **Best Balance** |
| `tinyllama` | ~2.2GB | 1.1B | ✅ Yes | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **Best if Auth Available** |
| `gemma-2b` | ~3.5GB | 2B | ❌ No | ⭐⭐⭐⭐ | ⭐⭐⭐ | Good Alternative |
| `opt-1.3b` | ~2.5GB | 1.3B | ❌ No | ⭐⭐⭐ | ⭐⭐⭐⭐ | Fast Alternative |

---

## 📥 Download Options

### Option 1: Use the Download Script (Recommended)

```bash
# List available models
python download_model.py --list

# Download Phi-2 (public, no auth required)
python download_model.py --model phi2

# Download Phi-1.5 (public, smaller)
python download_model.py --model phi1_5

# Download TinyLlama-1.1B (requires HF_TOKEN)
HF_TOKEN=your_huggingface_token python download_model.py --model tinyllama
```

### Option 2: Manual Download with Transformers

```bash
# Activate ML venv
source /tmp/helacore_ml_venv/bin/activate

# Download Phi-2
python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained('microsoft/phi-2')
tokenizer = AutoTokenizer.from_pretrained('microsoft/phi-2')
model.save_pretrained('models/phi-2')
tokenizer.save_pretrained('models/phi-2')
"
```

### Option 3: Using HuggingFace CLI

```bash
# Install hf CLI
/tmp/helacore_ml_venv/bin/pip install huggingface-hub

# Download with hf
hf download microsoft/phi-2 --local-dir models/phi-2
```

---

## 🚀 Quick Start Workflow

### Step 1: Download a Model

```bash
# Download Phi-2 (recommended for quality)
python download_model.py --model phi2

# Or download Phi-1.5 (recommended for speed)
python download_model.py --model phi1_5
```

### Step 2: Prepare Training Data

```bash
# Generate a balanced subset from your dataset
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-2 \
    --dataset /tmp/helacore_mega_dataset.jsonl \
    --generate-subset \
    --subset-size 1000 \
    --output checkpoints/phi2_data
```

### Step 3: Fine-Tune

```bash
# Fine-tune Phi-2
python ai_advisor/training/local_finetune_tinyllama.py \
    --model microsoft/phi-2 \
    --train checkpoints/phi2_data/train_subset_formatted.jsonl \
    --val checkpoints/phi2_data/val_subset_formatted.jsonl \
    --output checkpoints/phi2_finetuned \
    --epochs 3 \
    --batch-size 2 \
    --device cpu
```

### Step 4: Update Configuration

Edit `ai_advisor/config/model_config.yaml`:

```yaml
local_model:
  base_model: "microsoft/phi-2"
  adapter_path: "checkpoints/phi2_finetuned"
  device: "cpu"
```

Or update `ai_advisor/core/local_model.py`:

```python
class LocalModel:
    def __init__(
        self,
        base_model: str = "microsoft/phi-2",  # Changed
        adapter_path: str | Path = "checkpoints/phi2_finetuned",  # Changed
        ...
    ) -> None:
```

### Step 5: Test

```bash
python -c "
import asyncio
from ai_advisor.core.engine import HelacoreReasoningEngine
from ai_advisor.models.conversation import AdvisorRequest

async def test():
    engine = HelacoreReasoningEngine()
    req = AdvisorRequest(
        message='Why am I short on cash?',
        context_override={'business': {
            'type': 'retail shop', 'county': 'Nairobi', 'country': 'Kenya',
            'revenue_monthly_ksh': 500000, 'expenses_monthly_ksh': 480000,
            'cogs_monthly_ksh': 300000, 'gross_profit_monthly_ksh': 200000,
            'net_profit_monthly_ksh': 20000, 'cash_ksh': 100000,
            'inventory_ksh': 600000, 'receivables_ksh': 400000,
            'debt_ksh': 900000, 'customers': 500
        }}
    )
    resp = await engine.analyze(req)
    print(f'Model: {resp.model_used}')
    print(f'Diagnosis: {resp.diagnosis.summary[:200]}...')

asyncio.run(test())
"
```

---

## 📊 Current Download Status

### Phi-2 Download
- **Status**: ⏳ In Progress (partially downloaded)
- **Location**: `models/cache/models--microsoft--phi-2/`
- **Size Downloaded**: ~1.5GB
- **Total Size**: ~5.4GB
- **Issue**: Download timeout due to large size

### Solution Options

1. **Resume Download**: The partial download is cached. Retry with longer timeout:
   ```bash
   timeout 1800 python download_model.py --model phi2
   ```

2. **Use Smaller Model**: Download Phi-1.5 instead (~3.3GB):
   ```bash
   python download_model.py --model phi1_5
   ```

3. **Use Existing Model**: The current SmolLM2-135M is already set up and working, just with lower quality.

---

## 🎯 Recommendations

### For Immediate Use
1. **Use Phi-1.5** (~3.3GB, public, good balance of quality and size)
2. **Use existing SmolLM2-135M** (already downloaded and working)

### For Best Quality
1. **Complete Phi-2 download** (5.4GB, best quality)
2. **Get HF_TOKEN and download TinyLlama-1.1B** (2.2GB, excellent quality)

### For Fastest Setup
1. **Use Phi-1.5** - Download with: `python download_model.py --model phi1_5`
2. **Fine-tune with 1000 records** - Takes ~30-45 minutes on CPU
3. **Test and iterate**

---

## 📁 Files Created/Modified

### New Files
- `download_model.py` - Model download script
- `ai_advisor/training/local_finetune_tinyllama.py` - Training script for new models
- `ai_advisor/config/model_config.yaml` - Model configuration
- `MODEL_RETRAINING_GUIDE.md` - Comprehensive guide
- `RETRAINING_SUMMARY.md` - Quick summary
- `MODEL_DOWNLOAD_STATUS.md` - This file

### Modified Files
- None (all changes are additive)

---

## 🔧 Troubleshooting

### Issue: Download Timeout
**Solution**: Use `timeout` command or download in smaller batches:
```bash
timeout 3600 python download_model.py --model phi2
```

### Issue: Authentication Required
**Solution**: Set HF_TOKEN environment variable:
```bash
# Get token from https://huggingface.co/settings/tokens
HF_TOKEN=your_token python download_model.py --model tinyllama
```

### Issue: Out of Disk Space
**Solution**: 
- Free up space (need ~10GB for model + training)
- Use a smaller model (Phi-1.5 or OPT-1.3B)
- Clear cache: `rm -rf models/cache/`

### Issue: Slow Training
**Solution**:
- Use smaller batch size: `--batch-size 1`
- Use gradient accumulation: `--grad-accum 4`
- Reduce sequence length: `--max-length 256`

---

## 📞 Support

For issues with:
- **Downloads**: Check internet connection, disk space, authentication
- **Training**: Check ML venv has all dependencies, reduce batch size
- **Inference**: Check model paths, device configuration

---

## 🎉 Next Steps

1. **Download a model**: `python download_model.py --model phi1_5`
2. **Fine-tune**: Use `local_finetune_tinyllama.py`
3. **Test**: Verify quality with the engine
4. **Deploy**: Update configuration to use new model

---

*Last Updated: 2026-08-28*
*Status: ML Environment Ready, Download Scripts Created*
