import { useState } from "react";
import { api } from '../api';
import './QuestionAnswer.css';

export default function QuestionAnswer() {
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);

    const handleAsk = async () => {
        if (!question.trim()) return;

        setLoading(true);
        try {
            const response = await api.askQuestion(question);
            setAnswer(response);
        } catch (error) {
            console.error('Error asking question: ', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="question-answer">
            <h2>Ask a Question</h2>
            <div className="qa-input">
                <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your documents..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                />

                <button onClick={handleAsk} disabled={loading || !question.trim()}>
                    {loading ? 'Thinking...' : 'Ask'}
                </button>
            </div>

            {answer && (
                <div className="qa-answer">
                    <h3>Answer:</h3>
                    <p>{answer.answer}</p>
                    <div className="sources">
                        <h4>Sources:</h4>
                        {answer.sources.map((source, idx) => (
                            <span key={idx} className="source-tag">
                                {source.document}
                                ({(source.score * 100).toFixed(0)}%)
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>

    );
}