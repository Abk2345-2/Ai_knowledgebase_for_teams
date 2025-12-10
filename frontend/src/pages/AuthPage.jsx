import { useState } from "react";
import Login from "../components/Login";
import Register from "../components/Register";

export default function AuthPage() {
    const [showLogin, setShowLogin] = useState(true);

    return showLogin ? (
        <Login onSwitchToRegister={() => setShowLogin(false)} />
    ) : (
        <Register onSwitchToLogin={() => setShowLogin(true)} />
    )
}