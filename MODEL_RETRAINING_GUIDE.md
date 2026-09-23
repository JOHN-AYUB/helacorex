# Model Retraining Guide for Helacore AI Advisor

## Overview

This guide explains how to download a better small model (TinyLlama-1.1B or Phi-2) and fine-tune it for optimal performance with the Helacore AI Advisor.

---

## 🎯 Recommended Models

| Model | Size | Quality | Speed (CPU) | Notes |
|-------|------|---------|-------------|-------|
| **TinyLlama-1.1B** | 1.1B | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Best balance for 4-core Mac |
| **Phi-2** | 2.7B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Better quality, slightly slower |
| SmolLM2-135M | 135M | ⭐⭐ | ⭐⭐⭐⭐⭐ | Current model (too small, poor quality) |
| SmolLM2-360M | 360M | ⭐⭐⭐ | ⭐ | Too slow on 4-core Mac |

**Recommendation**: Use **TinyLlama-1.1B** for the best balance of quality and speed on your hardware.

---

## 📥 Step 1: Download the Model

### Option A: Using the ML Environment (Recommended)

```bash
# Activate or create the ML venv (Python 3.13 with all dependencies)
python3 -m venv /tmp/helacore_ml_venv
source /tmp/helacore_ml_venv/bin/activate

# Install dependencies
/tmp/helacore_ml_venv/bin/pip install torch transformers datasets peft accelerate

# Download TinyLlama-1.1B
/tmp/helacore_ml_venv/bin/python << 'PYEOF'
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path

model_dir = Path("models/tinyllama-1.1b")
model_dir.mkdir(parents=True, exist_ok=True)

print("Downloading TinyLlama-1.1B...")
model = AutoModelForCausalLM.from_pretrained("TinyLlama/TinyLlama-1.1B")
tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B")

model.save_pretrained(str(model_dir))
tokenizer.save_pretrained(str(model_dir))
print(f"✅ Model saved to: {model_dir.resolve()}")
PYEOF
```

### Option B: Manual Download via HuggingFace CLI

```bash
# Install huggingface_hub
pip install huggingface_hub

# Download (will cache to ~/.cache/huggingface/)
huggingface-cli download TinyLlama/TinyLlama-1.1B --local-dir models/tinyllama-1.1b

# Or for Phi-2
huggingface-cli download microsoft/phi-2 --local-dir models/phi-2
```

### Option C: Using Git LFS

```bash
# Install git lfs
git lfs install

# Clone the model
git lfs clone https://huggingface.co/TinyLlama/TinyLlama-1.1B models/tinyllama-1.1b
```

---

## 🔧 Step 2: Prepare Training Data

### Option A: Use Existing Prepared Data

If you already have prepared fine-tuning data:
```bash
# Your data should be in OpenAI chat format:
# {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}

# Example files:
# - checkpoints/checkpoints/finetune_data/train.jsonl
# - checkpoints/checkpoints/finetune_data/val.jsonl
```

### Option B: Generate from Mega Dataset

```bash
# Generate a balanced subset (1000 records)
python3 ai_advisor/training/local_finetune_tinyllama.py \
    --model TinyLlama/TinyLlama-1.1B \
    --dataset /tmp/helacore_mega_dataset.jsonl \
    --generate-subset \
    --subset-size 1000 \
    --output checkpoints/tinyllama_data

# This will create:
# - checkpoints/tinyllama_data/train_subset.jsonl
# - checkpoints/tinyllama_data/val_subset.jsonl
# - checkpoints/tinyllama_data/train_subset_formatted.jsonl
# - checkpoints/tinyllama_data/val_subset_formatted.jsonl
```

### Option C: Create Custom Dataset

Create a JSONL file with records in this format:
```json
{
  "id": "record-001",
  "domain": "diagnosis",
  "business": {
    "type": "retail shop",
    "county": "Nairobi",
    "country": "Kenya",
    "revenue_monthly_ksh": 500000,
    "expenses_monthly_ksh": 480000,
    "cogs_monthly_ksh": 300000,
    "gross_profit_monthly_ksh": 200000,
    "net_profit_monthly_ksh": 20000,
    "cash_ksh": 100000,
    "inventory_ksh": 600000,
    "receivables_ksh": 400000,
    "debt_ksh": 900000,
    "customers": 500
  },
  "derived_metrics": {
    "gross_margin_percent": 40.0,
    "net_margin_percent": 4.0,
    "inventory_turnover_proxy": 0.5,
    "liquidity_proxy": 0.21,
    "risk_flags": ["high_inventory_relative_to_revenue", "high_receivables", "low_liquidity"]
  },
  "instruction": "Why am I short on cash despite growing sales?",
  "context": "The business is a retail shop in Nairobi, Kenya...",
  "ideal_advisor_response": {
    "diagnosis": "The business has high inventory and receivables...",
    "actions": ["Review cash flow", "Reduce inventory", "Collect receivables"],
    "caution": "This is decision support only..."
  }
}
```

---

## 🚀 Step 3: Fine-Tune the Model

### Using the Training Script

```bash
# Fine-tune TinyLlama-1.1B on CPU
python3 ai_advisor/training/local_finetune_tinyllama.py \
    --model TinyLlama/TinyLlama-1.1B \
    --train checkpoints/tinyllama_data/train_subset_formatted.jsonl \
    --val checkpoints/tinyllama_data/val_subset_formatted.jsonl \
    --output checkpoints/tinyllama_finetuned \
    --epochs 3 \
    --batch-size 2 \
    --grad-accum 2 \
    --lr 2e-4 \
    --lora-r 16 \
    --lora-alpha 32 \
    --device cpu
```

### Training Parameters Explained

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `--model` | TinyLlama/TinyLlama-1.1B | Base model to fine-tune |
| `--train` | Path to train.jsonl | Training data in chat format |
| `--val` | Path to val.jsonl | Validation data in chat format |
| `--output` | checkpoints/tinyllama_finetuned | Output directory for fine-tuned model |
| `--epochs` | 3 | Number of training epochs |
| `--batch-size` | 2 | Batch size (reduce if OOM) |
| `--grad-accum` | 2 | Gradient accumulation steps |
| `--lr` | 2e-4 | Learning rate |
| `--lora-r` | 16 | LoRA rank |
| `--lora-alpha` | 32 | LoRA alpha |
| `--lora-dropout` | 0.05 | LoRA dropout rate |
| `--device` | cpu | Device to use (cpu, cuda, mps) |
| `--max-length` | 384 | Maximum sequence length |

### Expected Training Time

| Model | Hardware | Batch Size | Time per Epoch | Total (3 epochs) |
|-------|---------|------------|----------------|-----------------|
| TinyLlama-1.1B | 4-core CPU | 2 | ~20-30 min | ~60-90 min |
| TinyLlama-1.1B | M1/M2 Mac | 2 | ~15-20 min | ~45-60 min |
| Phi-2 | 4-core CPU | 2 | ~30-45 min | ~90-135 min |

---

## 🎯 Step 4: Update the Local Model Configuration

After fine-tuning, update the local model configuration:

### Update `ai_advisor/core/local_model.py`

```python
class LocalModel:
    def __init__(
        self,
        base_model: str = "TinyLlama/TinyLlama-1.1B",  # Changed from SmolLM2-135M
        adapter_path: str | Path = "checkpoints/tinyllama_finetuned",  # Updated path
        max_new_tokens: int = 300,
        temperature: float = 0.3,
        top_p: float = 0.9,
        device: str = "cpu",
    ) -> None:
        self.base_model = base_model
        self.adapter_path = str(adapter_path)
        # ... rest of the code
```

### Or Use Environment Variables

```bash
# In your .env file
export LOCAL_MODEL_BASE="TinyLlama/TinyLlama-1.1B"
export LOCAL_MODEL_PATH="checkpoints/tinyllama_finetuned"
```

---

## 🧪 Step 5: Test the Fine-Tuned Model

### Test with the Engine

```bash
python3 << 'PYEOF'
import asyncio
import sys
sys.path.insert(0, '.')

from ai_advisor.core.engine import HelacoreReasoningEngine
from ai_advisor.models.conversation import AdvisorRequest

async def test():
    engine = HelacoreReasoningEngine()
    
    req = AdvisorRequest(
        message="Why am I short on cash despite growing sales?",
        context_override={
            "business": {
                "type": "retail shop",
                "county": "Nairobi",
                "country": "Kenya",
                "goal": "grow sales",
                "primary_problem": "cash flow",
                "revenue_monthly_ksh": 500000,
                "expenses_monthly_ksh": 480000,
                "cogs_monthly_ksh": 300000,
                "gross_profit_monthly_ksh": 200000,
                "net_profit_monthly_ksh": 20000,
                "cash_ksh": 100000,
                "inventory_ksh": 600000,
                "receivables_ksh": 400000,
                "debt_ksh": 900000,
                "customers": 500,
            }
        },
    )
    
    resp = await engine.analyze(req)
    print(f"Model used: {resp.model_used}")
    print(f"Domain: {resp.domain}")
    print(f"\nDiagnosis:\n{resp.diagnosis.summary}")
    print(f"\nActions:")
    for a in resp.actions:
        print(f"  - {a.title}: {a.description}")

asyncio.run(test())
PYEOF
```

### Expected Output

With a properly fine-tuned TinyLlama-1.1B, you should see:
- **Model used**: `local:TinyLlama/TinyLlama-1.1B` (or similar)
- **Coherent diagnosis**: Properly formatted, grounded in data
- **Relevant actions**: 3-5 actionable recommendations
- **Proper formatting**: Follows the Helacore response structure

---

## 📊 Step 6: Evaluate Model Quality

### Manual Evaluation

Check these aspects of the output:

1. **Format**: Does it follow the JSON structure with diagnosis, actions, cautions?
2. **Grounding**: Are the recommendations based on the actual financial data?
3. **Relevance**: Do the actions address the stated problem?
4. **Language**: Is the output in the correct language (English/Swahili)?
5. **Safety**: Are appropriate cautions included?

### Automated Evaluation

Use the existing evaluation pipeline:

```bash
python3 << 'PYEOF'
from ai_advisor.training.evaluator import AdvisorEvaluator
from ai_advisor.training.data_loader import HelacoreDatasetLoader

# Load test data
loader = HelacoreDatasetLoader()
records = loader.load_dataset("checkpoints/checkpoints/finetune_data/val.jsonl", limit=50)

# Evaluate
evaluator = AdvisorEvaluator()
results = evaluator.evaluate_batch(records, model_type="local")

print(f"Overall score: {results['overall_score']:.4f}")
print(f"Diagnosis score: {results['diagnosis_score']:.4f}")
print(f"Financial accuracy: {results['financial_accuracy']:.4f}")
print(f"Completeness: {results['completeness']:.4f}")
print(f"Safety: {results['safety']:.4f}")
PYEOF
```

---

## 🔄 Step 7: Iterate and Improve

### If Quality is Still Poor

1. **Increase dataset size**: Use more training records (5000-10000)
   ```bash
   python3 ai_advisor/training/local_finetune_tinyllama.py \
       --generate-subset \
       --subset-size 5000
   ```

2. **Increase model size**: Try Phi-2 (2.7B params)
   ```bash
   python3 ai_advisor/training/local_finetune_tinyllama.py \
       --model microsoft/phi-2 \
       --subset-size 2000
   ```

3. **Adjust hyperparameters**:
   ```bash
   --epochs 5 \
   --lr 1e-4 \
   --lora-r 32 \
   --lora-alpha 64
   ```

4. **Improve data quality**:
   - Filter for high-quality records
   - Add more diverse examples
   - Include more domain-specific templates

---

## 💡 Tips for Better Results

### 1. Use GPU if Available

If you have access to a GPU machine:
```bash
python3 ai_advisor/training/local_finetune_tinyllama.py \
    --device cuda \
    --batch-size 4 \
    --grad-accum 1
```

### 2. Use 4-bit Quantization

For larger models on limited hardware:
```python
# In the training script, change:
model = AutoModelForCausalLM.from_pretrained(
    config.model_name,
    device_map=device_map,
    torch_dtype=torch.float32,
    load_in_4bit=True,  # Add this
)
```

### 3. Use Better Tokenization

TinyLlama uses a different tokenizer than SmolLM2. The chat template might need adjustment:
```python
# In local_finetune_tinyllama.py, update the tokenize_function:
def tokenize_function(examples):
    messages = examples["messages"]
    tokenized = tokenizer.apply_chat_template(
        messages,
        tokenize=True,
        add_generation_prompt=True,  # Try with and without
        padding=False,
    )
    return {"input_ids": tokenized, "attention_mask": [1] * len(tokenized)}
```

---

## 📚 Model Comparison

| Aspect | SmolLM2-135M | TinyLlama-1.1B | Phi-2 |
|--------|--------------|----------------|------|
| Parameters | 135M | 1.1B | 2.7B |
| Quality | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Speed (CPU) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Memory | ~500MB | ~2.2GB | ~5.4GB |
| Training Time | Fast | Moderate | Slow |
| Recommendation | ❌ Not suitable | ✅ **Best choice** | ⚠️ If you have patience |

---

## 🎉 Expected Outcomes

With TinyLlama-1.1B fine-tuned on 1000-5000 high-quality records:

✅ **Coherent output**: Properly formatted JSON responses  
✅ **Grounded advice**: Recommendations based on actual financial data  
✅ **Domain knowledge**: Understands business contexts and terminology  
✅ **Actionable insights**: Provides specific, useful recommendations  
✅ **Safety**: Includes appropriate cautions and limitations  

---

## 🚀 Quick Start Commands

```bash
# 1. Download model (using ML venv)
/tmp/helacore_ml_venv/bin/python -c "
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
Path('models/tinyllama-1.1b').mkdir(parents=True, exist_ok=True)
AutoModelForCausalLM.from_pretrained('TinyLlama/TinyLlama-1.1B').save_pretrained('models/tinyllama-1.1b')
AutoTokenizer.from_pretrained('TinyLlama/TinyLlama-1.1B').save_pretrained('models/tinyllama-1.1b')
"

# 2. Generate training data
python3 ai_advisor/training/local_finetune_tinyllama.py \
    --model TinyLlama/TinyLlama-1.1B \
    --dataset /tmp/helacore_mega_dataset.jsonl \
    --generate-subset \
    --subset-size 1000 \
    --output checkpoints/tinyllama_data

# 3. Fine-tune
python3 ai_advisor/training/local_finetune_tinyllama.py \
    --model TinyLlama/TinyLlama-1.1B \
    --train checkpoints/tinyllama_data/train_subset_formatted.jsonl \
    --val checkpoints/tinyllama_data/val_subset_formatted.jsonl \
    --output checkpoints/tinyllama_finetuned \
    --epochs 3 \
    --device cpu

# 4. Test
python3 -c "
import asyncio
from ai_advisor.core.engine import HelacoreReasoningEngine
from ai_advisor.models.conversation import AdvisorRequest

async def test():
    engine = HelacoreReasoningEngine()
    req = AdvisorRequest(message='Why am I short on cash?', context_override={'business': {'type': 'retail shop', 'county': 'Nairobi', 'country': 'Kenya', 'revenue_monthly_ksh': 500000, 'expenses_monthly_ksh': 480000, 'cogs_monthly_ksh': 300000, 'gross_profit_monthly_ksh': 200000, 'net_profit_monthly_ksh': 20000, 'cash_ksh': 100000, 'inventory_ksh': 600000, 'receivables_ksh': 400000, 'debt_ksh': 900000, 'customers': 500}})
    resp = await engine.analyze(req)
    print(f'Model: {resp.model_used}')
    print(f'Diagnosis: {resp.diagnosis.summary[:200]}...')

asyncio.run(test())
"
```

---

## 📞 Support

If you encounter issues:

1. **Check dependencies**: Ensure all packages are installed in the correct Python environment
2. **Check disk space**: Models require several GB of storage
3. **Check memory**: Training requires sufficient RAM (4GB+ for TinyLlama-1.1B)
4. **Check logs**: Look for errors in the training output
5. **Reduce batch size**: If you get OOM errors, reduce `--batch-size`

---

*Last updated: 2026-08-28*
*Project: Helacore AI Advisor*
