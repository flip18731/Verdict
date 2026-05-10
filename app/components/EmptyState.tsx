interface Props {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 24px",
        color: "var(--text-3)",
      }}
    >
      {icon ? (
        <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      ) : null}
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-2)",
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: action ? 16 : 0,
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          {description}
        </div>
      ) : null}
      {action ? (
        <div style={{ marginTop: 16 }}>{action}</div>
      ) : null}
    </div>
  );
}
