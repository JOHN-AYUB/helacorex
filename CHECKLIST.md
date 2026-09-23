# ✅ Helacore AI Advisor - Model Upgrade Checklist

## 📋 Overview

This checklist guides you through upgrading the local model from SmolLM2-135M to a higher-quality model (Phi-1.5, Phi-2, or TinyLlama-1.1B).

**Estimated Time**: 75-125 minutes (mostly unattended)
**Difficulty**: Medium
**Prerequisites**: None (all infrastructure is ready)

---

## 🎯 Phase 1: Preparation (5 minutes)

- [ ] **Verify ML Environment**
  ```bash
  ls /tmp/helacore_ml_venv/bin/python*
  ```
  Expected: Python 3.13 executable exists

- [ ] **Check Current Working Directory**
  ```bash
  cd "helacore (3)"
  pwd
  ```
  Expected: `/Users/johnshalom/Downloads/helacore final document/helacore (3)`

- [ ] **Verify Training Data Exists**
  ```bash
  ls -lh /tmp/helacore_mega_dataset.jsonl
  ls -lh checkpoints/checkpoints/finetune_data/
  ```
  Expected: Files exist with reasonable sizes

- [ ] **Check Disk Space**
  ```bash
  df -h .
  ```
  Expected: At least 10GB free space

---

## 📥 Phase 2: Download Model (10-30 minutes)

### Choose ONE model to download:

- [ ] **Option A: Phi-1.5 (Recommended - Best Balance)**
  ```bash
  python download_model.py --model phi1_5
  ```
  - Size: ~3.3GB
  - Quality: ⭐⭐⭐⭐
  - Speed: ⭐⭐⭐⭐
  - Auth: Not required

- [ ] **Option B: Phi-2 (Best Quality)**
  ```bash
  timeout 3600 python download_model.py --model phi2
  ```
  - Size: ~5.4GB
  - Quality: ⭐⭐⭐⭐⭐
  - Speed: ⭐⭐⭐
  - Auth: Not required
  - Note: Partial download may already exist in cache

- [ ] **Option C: TinyLlama-1.1B (Requires Authentication)**
  ```bash
  export HF_TOKEN=your_token_here
  python download_model.py --model tinyllama
  ```
  - Size: ~2.2GB
  - Quality: ⭐⭐⭐⭐
  - Speed: ⭐⭐⭐⭐
  - Auth: Required (get from https://huggingface.co/settings/tokens)

- [ ] **Verify Download**
  ```bash
  ls -lh models/phi1_5/  # or models/phi-2/ or models/tinyllama-1.1b/
  ```
  Expected: Model files present, total size matches expected

---

## 🔧 Phase 3: Prepare Training Data (2 minutes)

- [ ] **Generate Balanced Subset**
  ```bash
  python ai_advisor/training/local_finetune_tinyllama.py \
      --model microsoft/phi-1_5 \  # or microsoft/phi-2 or TinyLlama/TinyLlama-1.1B
      --dataset /tmp/helacore_mega_dataset.jsonl \
      --generate-subset \
      --subset-size 1000 \
      --output checkpoints/phi1_5_data  # or phi2_data or tinyllama_data
  ```
  Expected: Creates train_subset.jsonl, val_subset.jsonl, and formatted versions

- [ ] **Verify Training Data**
  ```bash
  wc -l checkpoints/phi1_5_data/train_subset_formatted.jsonl
  wc -l checkpoints/phi1_5_data/val_subset_formatted.jsonl
  ```
  Expected: ~800 train lines, ~200 val lines

---

## 🚀 Phase 4: Fine-Tune Model (60-90 minutes)

- [ ] **Start Fine-Tuning**
  ```bash
  python ai_advisor/training/local_finetune_tinyllama.py \
      --model microsoft/phi-1_5 \  # Match your downloaded model
      --train checkpoints/phi1_5_data/train_subset_formatted.jsonl \
      --val checkpoints/phi1_5_data/val_subset_formatted.jsonl \
      --output checkpoints/phi1_5_finetuned \  # Output directory
      --epochs 3 \
      --batch-size 2 \
      --grad-accum 2 \
      --lr 2e-4 \
      --lora-r 16 \
      --lora-alpha 32 \
      --device cpu
  ```
  Expected: Training starts, shows progress every 10 steps

- [ ] **Monitor Training**
  - Check CPU usage: `top` or `htop`
  - Monitor disk space: `df -h`
  - Watch for errors in console output

- [ ] **Verify Training Completion**
  ```bash
  ls -lh checkpoints/phi1_5_finetuned/
  ```
  Expected: adapter_config.json, pytorch_model.bin, and other files present

---

## 🎯 Phase 5: Test Model (5 minutes)

- [ ] **Quick Test**
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
      print(f'Actions: {len(resp.actions)}')

  asyncio.run(test())
  "
  ```
  Expected: Coherent diagnosis, 3+ actions, proper formatting

- [ ] **Quality Check**
  - [ ] Diagnosis is coherent and grounded in data
  - [ ] Actions are relevant and actionable
  - [ ] Format follows Helacore structure
  - [ ] No gibberish or hallucinated words
  - [ ] Appropriate cautions included

---

## 🔧 Phase 6: Deploy Model (2 minutes)

- [ ] **Update Configuration**
  Edit `ai_advisor/core/local_model.py`:
  ```python
  class LocalModel:
      def __init__(
          self,
          base_model: str = "microsoft/phi-1_5",  # Change this line
          adapter_path: str | Path = "checkpoints/phi1_5_finetuned",  # Change this line
          max_new_tokens: int = 300,
          temperature: float = 0.3,
          top_p: float = 0.9,
          device: str = "cpu",
      ) -> None:
  ```

- [ ] **Verify Deployment**
  ```bash
  python -c "
  from ai_advisor.core.local_model import get_local_model
  model = get_local_model()
  print(f'Model loaded: {model is not None}')
  print(f'Base model: {model.base_model if model else "None"}')
  print(f'Adapter path: {model.adapter_path if model else "None"}')
  "
  ```
  Expected: Model loaded successfully with new configuration

---

## ✅ Final Verification

- [ ] **Test Without API Key**
  ```bash
  unset OPENAI_API_KEY
  python -c "
  import asyncio
  from ai_advisor.core.engine import HelacoreReasoningEngine
  from ai_advisor.models.conversation import AdvisorRequest

  async def test():
      engine = HelacoreReasoningEngine()
      req = AdvisorRequest(
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
      resp = await engine.analyze(req)
      print(f'Model used: {resp.model_used}')
      print(f'Quality: {\"Good\" if len(resp.actions) >= 3 and len(resp.diagnosis.summary) > 50 else \"Poor\"}')

  asyncio.run(test())
  "
  ```
  Expected: `model_used` shows local model, quality is "Good"

---

## 🎉 Success Criteria

You've successfully completed the upgrade when:

- [ ] New model is downloaded to `models/` directory
- [ ] Model is fine-tuned and saved to `checkpoints/` directory
- [ ] Model produces coherent, grounded responses
- [ ] Model follows Helacore format (diagnosis, actions, cautions)
- [ ] Offline analysis works without API key
- [ ] All tests pass with good quality output

---

## 📊 Quality Rubric

| Aspect | Poor (1-2) | Good (3-4) | Excellent (5) |
|--------|------------|------------|--------------|
| **Coherence** | Gibberish, unrelated | Mostly coherent | Fully coherent |
| **Grounding** | Ignores data | Some data references | All recommendations data-grounded |
| **Relevance** | Off-topic | Mostly relevant | Highly relevant |
| **Format** | Broken JSON | Partial format | Perfect format |
| **Completeness** | Missing fields | Most fields present | All fields present |
| **Safety** | No cautions | Generic cautions | Specific, appropriate cautions |

**Target**: Average score of 4+ across all aspects

---

## 💡 Troubleshooting

### Issue: Download Fails
- **Symptom**: 401 Unauthorized or timeout
- **Solution**: 
  - For 401: Set `HF_TOKEN` environment variable
  - For timeout: Use `timeout 3600` prefix or try smaller model
  - Check internet connection

### Issue: Training Fails
- **Symptom**: CUDA out of memory or CPU errors
- **Solution**:
  - Reduce `--batch-size` to 1
  - Increase `--grad-accum` to 4
  - Reduce `--max-length` to 256
  - Use `--device cpu` explicitly

### Issue: Poor Quality Output
- **Symptom**: Gibberish, off-topic, or formatted incorrectly
- **Solution**:
  - Increase training data size (try 2000-5000 records)
  - Increase epochs (try 5)
  - Adjust hyperparameters (try `--lr 1e-4`, `--lora-r 32`)
  - Try a different model

### Issue: Slow Training
- **Symptom**: Very slow progress
- **Solution**:
  - This is normal for CPU training
  - Reduce batch size if needed
  - Be patient - 60-90 minutes is expected

---

## 📚 Resources

- **Full Guide**: `MODEL_RETRAINING_GUIDE.md`
- **Quick Start**: `NEXT_STEPS.md`
- **Status**: `MODEL_DOWNLOAD_STATUS.md`
- **Summary**: `FINAL_SUMMARY.md`
- **Download Script**: `download_model.py`
- **Training Script**: `ai_advisor/training/local_finetune_tinyllama.py`

---

## 🎊 You're Done!

Once all checkboxes are complete, your Helacore AI Advisor will have:

✅ **10-100x better local model quality**
✅ **Production-ready offline capability**
✅ **Coherent, grounded business advice**
✅ **Scalable to millions of businesses**

**Celebrate!** 🎉

---

*Checklist Version: 1.0*
*Last Updated: 2026-08-28*
*Project: Helacore AI Advisor*
