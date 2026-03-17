import { useState } from "react";
import { signup } from "../lib/api";

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      await signup({ email, password, nickname });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("회원가입 실패: " + err.message);
      } else {
        setError("회원가입 실패: 알 수 없는 오류");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="닉네임"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        required
      />
      <button type="submit">회원가입</button>
      {success && <p>회원가입 성공! 로그인 페이지로 이동하세요.</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}

export default SignupForm;
