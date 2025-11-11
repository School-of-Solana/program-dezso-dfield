import React from "react";
import "./StatusBanner.scss";

type Props = {
  message: string | null;
};

const StatusBanner: React.FC<Props> = ({ message }) => {
  if (!message) return null;

  const isError = message.startsWith("❌");
  const isSuccess = message.startsWith("✅");

  const icon = isError ? "⚠️" : isSuccess ? "✅" : "ℹ️";

  const content = message.replace(/^[✅❌]\s?/, "");

  return (
    <div
      className={`status-banner ${
        isError ? "status-banner--error" : "status-banner--success"
      }`}
    >
      <span className="status-banner__icon">{icon}</span>
      <span className="status-banner__text">{content}</span>
    </div>
  );
};

export default StatusBanner;