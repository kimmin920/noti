export default function PreviewPage() {
  return (
    <div className="min-h-[100dvh] bg-[#f6f8fa]">
      <iframe
        title="V2 prototype preview"
        src="/prototypes/messaging-console-v4.html"
        className="block h-[100dvh] w-full border-0"
      />
    </div>
  );
}
