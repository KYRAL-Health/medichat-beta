export function LoadingDots({
  sizeClassName = "h-1.5 w-1.5",
}: {
  sizeClassName?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-block rounded-full bg-current ${sizeClassName}`}
        style={{
          animation: "medichat-bounce 1.4s infinite ease-in-out both",
          animationDelay: "-0.32s",
        }}
      />
      <span
        className={`inline-block rounded-full bg-current ${sizeClassName}`}
        style={{
          animation: "medichat-bounce 1.4s infinite ease-in-out both",
          animationDelay: "-0.16s",
        }}
      />
      <span
        className={`inline-block rounded-full bg-current ${sizeClassName}`}
        style={{
          animation: "medichat-bounce 1.4s infinite ease-in-out both",
        }}
      />
    </span>
  );
}


