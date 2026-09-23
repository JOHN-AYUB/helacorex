#!/bin/bash

echo "=========================================="
echo "Helacore: Setup TinyLlama-1.1B"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "ai_advisor/core/engine.py" ]; then
    echo "❌ Error: Run this from the helacore (3) directory"
    exit 1
fi

# Create models directory
mkdir -p models/tinyllama-1.1b
echo "✅ Created models directory"

# Check for Python 3.13 venv
if [ -d "/tmp/helacore_ml_venv" ]; then
    echo "✅ Found ML venv at /tmp/helacore_ml_venv"
    VENV_PYTHON="/tmp/helacore_ml_venv/bin/python"
else
    echo "⚠️  ML venv not found at /tmp/helacore_ml_venv"
    echo "   Creating new venv with Python 3.13..."
    python3 -m venv /tmp/helacore_ml_venv
    VENV_PYTHON="/tmp/helacore_ml_venv/bin/python"
    $VENV_PYTHON -m pip install --upgrade pip
    $VENV_PYTHON -m pip install torch transformers datasets peft accelerate
fi

echo ""
echo "Downloading TinyLlama-1.1B model..."
echo "This will take several minutes and require ~2.2GB of disk space"
echo ""

$VENV_PYTHON << 'PYEOF'
from transformers import AutoModelForCausalLM, AutoTokenizer
from pathlib import Path
import sys

model_dir = Path("models/tinyllama-1.1b")

try:
    print("Downloading model...")
    model = AutoModelForCausalLM.from_pretrained(
        "TinyLlama/TinyLlama-1.1B",
        cache_dir=str(Path("models/cache")),
    )
    
    print("Downloading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        "TinyLlama/TinyLlama-1.1B",
        cache_dir=str(Path("models/cache")),
    )
    
    print("Saving to models/tinyllama-1.1b...")
    model.save_pretrained(str(model_dir))
    tokenizer.save_pretrained(str(model_dir))
    
    print(f"\n✅ TinyLlama-1.1B successfully downloaded and saved to:")
    print(f"   {model_dir.resolve()}")
    print(f"\nModel files:")
    for f in sorted(model_dir.glob("*")):
        size = f.stat().st_size / (1024*1024)
        print(f"   {f.name:30s} ({size:.1f} MB)")
    
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ Download failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYEOF

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ Model Download Complete!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo ""
    echo "1. Generate training data subset:"
    echo "   python3 ai_advisor/training/local_finetune_tinyllama.py \\"
    echo "       --model TinyLlama/TinyLlama-1.1B \\"
    echo "       --dataset /tmp/helacore_mega_dataset.jsonl \\"
    echo "       --generate-subset \\"
    echo "       --subset-size 1000 \\"
    echo "       --output checkpoints/tinyllama_data"
    echo ""
    echo "2. Fine-tune the model:"
    echo "   python3 ai_advisor/training/local_finetune_tinyllama.py \\"
    echo "       --model TinyLlama/TinyLlama-1.1B \\"
    echo "       --train checkpoints/tinyllama_data/train_subset_formatted.jsonl \\"
    echo "       --val checkpoints/tinyllama_data/val_subset_formatted.jsonl \\"
    echo "       --output checkpoints/tinyllama_finetuned \\"
    echo "       --epochs 3 \\"
    echo "       --device cpu"
    echo ""
    echo "See MODEL_RETRAINING_GUIDE.md for detailed instructions"
else
    echo ""
    echo "❌ Model download failed"
    echo "Try manual download:"
    echo "  1. huggingface-cli download TinyLlama/TinyLlama-1.1B --local-dir models/tinyllama-1.1b"
    echo "  2. Or use the ML venv directly to run the download script"
fi
