import SignupForm from "../components/SignupForm";

function Signup() {
  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "2rem" }}>
      <h1>회원가입</h1>
      <SignupForm />
    </div>
  );
}

export default Signup;
