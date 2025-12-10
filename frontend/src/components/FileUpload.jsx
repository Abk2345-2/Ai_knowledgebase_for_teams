import { useState } from "react";
import { api } from "../api";
import './FileUpload.css';

export default function FileUpload({ onUploadSuccess }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setMessage('');
    }

    const handleUpload = async () => {
        if (!file) {
            setMessage(`Please select a file first`);
            return;
        }

        setUploading(true);
        setMessage('');

        try {
            await api.uploadDocument(file);
            setMessage('File uploaded successfully');
            setFile(null);
            document.getElementById('file-input').value = '';
            if (onUploadSuccess) onUploadSuccess();
        } catch (error) {
            setMessage(`Failed to Upload File: ${error.message}`);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="file-upload">
            <h2>Upload Document</h2>
            <div className="upload-container">
                <input
                    id="file-input"
                    type="file"
                    onChange={handleFileChange}
                    disabled={uploading}
                />
                <button onClick={handleUpload} disabled={uploading || !file}>
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </div>
            {message && (
                <p className={message.includes('success') ? 'success' : 'error'}>{message}</p>
            )}
        </div>
    )
}
