from groq import Groq   
import os

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def generate_answer(question: str, context_chunks: list[str]) -> str:
    context = "\n\n".join(context_chunks)

    prompt = f"""Based on the following context, answer the question. If the answer is not in the context, say "I don't have enough information to answer that."
    Context:
    {context}

    Question: {question}

    Answer:"""

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that answers questions based on provided context."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    return response.choices[0].message.content
