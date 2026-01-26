import React, { useState, useEffect } from "react";
import "./index.css";

interface ResponseModalProps {
  successful: boolean;
  message: string;
  setShow: (value: boolean) => void;
}

const ResponseModal = ({
  successful,
  message,
  setShow,
}: ResponseModalProps) => {
  const closeModal = () => {
    setShow(false);
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, []);

  return (
    <div className="app">
      <div className="modal-overlay bg-background text-foreground">
        <div className="modal bg-background text-foreground">
          <div className="modal-content bg-background text-foreground">
            {successful ? (
              <>
                <span className="success-icon">✔️</span>
                <p className="bg-background text-foreground">{message}</p>
              </>
            ) : (
              <>
                <span className="failure-icon">❌</span>
                <p className="bg-background text-foreground">{message}</p>
              </>
            )}
            <button className="modal-close-button" onClick={closeModal}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResponseModal;
