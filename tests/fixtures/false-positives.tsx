// Fixture: strings that must be filtered out by scanner/filters.ts

export function FalsePositivesComponent() {
  console.log("debug message");

  return (
    <div
      className="flex items-center justify-between bg-gray-100 p-4"
      data-testid="container"
      aria-label="container"
    >
      <img src="https://example.com/logo.png" alt="logo" />
      <a href="mailto:support@example.com">contact</a>
      <span className="text-sm font-bold">A</span>
      <input type="email" />
    </div>
  );
}
