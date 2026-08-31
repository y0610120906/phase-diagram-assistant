"""批量导入 knowledge_docs/ 下所有 PDF 到知识库"""
import sys
from pathlib import Path

# Add parent to path so we can import backend modules
sys.path.insert(0, str(Path(__file__).resolve().parent))

from services.knowledge_service import knowledge_service
from config import KNOWLEDGE_DOCS_DIR

def main():
    pdf_files = list(KNOWLEDGE_DOCS_DIR.rglob("*.pdf"))
    if not pdf_files:
        print("未找到 PDF 文件，请将 PDF 放入 knowledge_docs/ 下的子文件夹中")
        return

    print(f"找到 {len(pdf_files)} 个 PDF 文件\n")

    for pdf_path in pdf_files:
        print(f"处理: {pdf_path.relative_to(KNOWLEDGE_DOCS_DIR.parent)} ... ", end="", flush=True)
        try:
            result = knowledge_service.upload_pdf(pdf_path)
            if result.success:
                print(f"OK ({result.chunks_created} chunks)")
            else:
                print(f"FAIL: {result.message}")
        except Exception as e:
            print(f"ERROR: {e}")

    stats = knowledge_service.get_collection_stats()
    print(f"\n知识库总计: {stats['total_chunks']} chunks")

if __name__ == "__main__":
    main()
