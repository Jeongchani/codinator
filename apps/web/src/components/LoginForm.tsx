import { useState } from "react";
import { login } from "../lib/api";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const res = await login({ email, password });
      // 백엔드에서 JWT 토큰을 응답으로 준다고 가정
      setToken(res.accessToken);
      localStorage.setItem("token", res.accessToken); // 토큰 저장
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("로그인 실패: " + err.message);
      } else {
        setError("로그인 실패: 알 수 없는 오류");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>이메일</label>
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label>비밀번호</label>
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit">로그인</button>
      {token && <p>로그인 성공! 토큰: {token}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}

export default LoginForm;
