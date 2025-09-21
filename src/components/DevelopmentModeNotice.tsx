import React from 'react';

const DevelopmentModeNotice: React.FC = () => {
  return (
    <div className="alert alert-info alert-dismissible fade show" role="alert">
      <div className="d-flex align-items-start">
        <div className="me-3">
          <span style={{ fontSize: '1.5rem' }}>🚨</span>
        </div>
        <div className="flex-grow-1">
          <h6 className="alert-heading mb-2">Development Mode Active</h6>
          <p className="mb-2 small">
            This app is currently running in development mode with <strong>simulated stock data</strong>. 
            The Zerodha KiteConnect API cannot be called directly from the browser due to CORS security restrictions.
          </p>
          <hr className="my-2" />
          <p className="mb-0 small">
            <strong>For production use:</strong>
          </p>
          <ul className="small mb-0 ps-3">
            <li>Set up a backend server to handle API calls</li>
            <li>Implement proper OAuth flow on the server side</li>
            <li>Use server-side proxy for all Zerodha API requests</li>
          </ul>
        </div>
      </div>
      <button 
        type="button" 
        className="btn-close" 
        data-bs-dismiss="alert" 
        aria-label="Close"
      ></button>
    </div>
  );
};

export default DevelopmentModeNotice;