// Fixture: simple login page with hardcoded strings — used by scanner tests

export function LoginPage() {
  return (
    <div>
      <h1>Welcome back</h1>
      <p>Sign in to continue</p>
      <input placeholder="Enter your email" type="email" />
      <input placeholder="Enter your password" type="password" />
      <button type="submit">Sign in</button>
      <a href="/forgot-password">Forgot your password?</a>
    </div>
  );
}
