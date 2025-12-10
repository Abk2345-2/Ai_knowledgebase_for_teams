import { useState, useEffect } from "react";
import { api } from '../api';
import './DocumentList.css';

export default function DocumentList({ refreshTrigger }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchDocuments = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.getDocuments();
            setDocuments(data);
        } catch (error) {
            setError('Failed to load documents: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchDocuments();
    }, [refreshTrigger]);

    if (loading) {
        return <div className="loading"> Loading documents... </div>
    }
    if (error) {
        return <div className="error">{error}</div>
    }
    return (
        <div className="document-list">
            <h2>Uploaded Documents</h2>
            {documents.length === 0 ? (
                <p className="no-documents">No documents uploaded yet</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>FileName</th>
                            <th>Uploaded At</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {documents.map((doc) => (
                            <tr key={doc.id}>
                                <td>{doc.id}</td>
                                <td>{doc.filename}</td>
                                <td>{new Date(doc.uploaded_at).toLocaleString()}</td>
                                <td><span className={doc.processed ? 'processed' : 'pending'}>
                                    {doc.processed ? 'Processed' : 'Pending'}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    )

}