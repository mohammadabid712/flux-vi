import { useAuth } from "@fastshot/auth";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Fonts } from "@/constants/Typography";
import { useTheme } from "@/hooks/use-theme";
import { errorMessage } from "@/services/cloud";
import { FormField } from "./form-field";

type Mode = "signin" | "signup";
type FieldErrors = Partial<Record<"name" | "email" | "password" | "confirm", string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Props {
  onSignedIn: () => void;
  onGuest: () => void;
}

function Notice({ icon, tone, title, message, children }: { icon: "mail-unread-outline" | "key-outline"; tone: string; title: string; message: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.notice}>
      <View style={[styles.noticeIcon, { backgroundColor: `${tone}22`, borderColor: `${tone}55` }]}>
        <Ionicons name={icon} size={28} color={tone} />
      </View>
      <Text style={[styles.noticeTitle, { color: colors.text }]}>{title}</Text>
      <Text selectable style={[styles.noticeMsg, { color: colors.muted }]}>
        {message}
      </Text>
      {children}
    </View>
  );
}

export function AuthForms({ onSignedIn, onGuest }: Props) {
  const { colors } = useTheme();
  const { signInWithEmail, signUpWithEmail, resetPassword, isLoading, clearError } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      setFieldErrors({});
      setFormError(null);
      clearError();
    },
    [clearError],
  );

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    const e = email.trim();
    if (!e) errs.email = "Email is required";
    else if (!EMAIL_RE.test(e)) errs.email = "Enter a valid email address";
    if (!resetMode) {
      if (!password) errs.password = "Password is required";
      else if (mode === "signup" && password.length < 8) errs.password = "Use at least 8 characters";
      else if (mode === "signup" && !(/[A-Za-z]/.test(password) && /\d/.test(password)))
        errs.password = "Weak password: mix letters and numbers";
      if (mode === "signup") {
        if (!name.trim()) errs.name = "Display name is required";
        if (confirm !== password) errs.confirm = "Passwords do not match";
      }
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const e = email.trim();
      if (resetMode) {
        await resetPassword(e);
        setResetSentTo(e);
      } else if (mode === "signin") {
        await signInWithEmail(e, password);
        onSignedIn();
      } else {
        const res = await signUpWithEmail(e, password, { data: { display_name: name.trim() } });
        if (res.emailConfirmationRequired) setConfirmationEmail(res.email || e);
        else onSignedIn();
      }
    } catch (err) {
      console.error("Auth request failed", err);
      setFormError(errorMessage(err, "Authentication failed. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const goSignIn = () => {
    setConfirmationEmail(null);
    setResetMode(false);
    setResetSentTo(null);
    setPassword("");
    setConfirm("");
    switchMode("signin");
  };

  if (confirmationEmail) {
    return (
      <Notice
        icon="mail-unread-outline"
        tone={colors.cyan}
        title="Check your email"
        message={`We sent a verification link to ${confirmationEmail}. Open it to activate your Flux VI cloud account, then sign in.`}
      >
        <Button label="Go to Sign In" icon="log-in-outline" size="lg" onPress={goSignIn} style={styles.full} />
        <Button label="Continue as Guest (Local Only)" variant="ghost" onPress={onGuest} />
      </Notice>
    );
  }

  if (resetSentTo) {
    return (
      <Notice
        icon="key-outline"
        tone={colors.primary}
        title="Reset link sent"
        message={`If an account exists for ${resetSentTo}, password reset instructions are on their way.`}
      >
        <Button label="Back to Sign In" icon="arrow-back" size="lg" onPress={goSignIn} style={styles.full} />
      </Notice>
    );
  }

  const pending = busy || isLoading;
  const submitLabel = resetMode ? "Send Reset Link" : mode === "signin" ? "Sign In" : "Create Account";

  return (
    <View style={styles.form}>
      {resetMode ? (
        <View style={styles.resetHead}>
          <Text style={[styles.resetTitle, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.resetSub, { color: colors.muted }]}>Enter your account email and we&apos;ll send a reset link.</Text>
        </View>
      ) : (
        <Segmented
          options={[
            { value: "signin", label: "Sign In" },
            { value: "signup", label: "Create Account" },
          ]}
          value={mode}
          onChange={switchMode}
          variant="joined"
          accessibilityLabel="Account mode"
        />
      )}

      {mode === "signup" && !resetMode ? (
        <FormField
          label="Display Name"
          icon="person-outline"
          value={name}
          onChangeText={setName}
          placeholder="Alex Rivera"
          autoComplete="name"
          error={fieldErrors.name}
          editable={!pending}
        />
      ) : null}
      <FormField
        label="Email"
        icon="mail-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@studio.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={fieldErrors.email}
        editable={!pending}
      />
      {!resetMode ? (
        <FormField
          label="Password"
          icon="lock-closed-outline"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
          secure
          autoCapitalize="none"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          error={fieldErrors.password}
          editable={!pending}
          onSubmitEditing={mode === "signin" ? submit : undefined}
        />
      ) : null}
      {mode === "signup" && !resetMode ? (
        <FormField
          label="Confirm Password"
          icon="shield-checkmark-outline"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Repeat password"
          secure
          autoCapitalize="none"
          error={fieldErrors.confirm}
          editable={!pending}
          onSubmitEditing={submit}
        />
      ) : null}

      {formError ? (
        <View style={[styles.errorBox, { borderColor: `${colors.red}66`, backgroundColor: `${colors.red}14` }]}>
          <Ionicons name="alert-circle" size={17} color={colors.red} />
          <Text selectable accessibilityRole="alert" style={[styles.errorText, { color: colors.red }]}>
            {formError}
          </Text>
        </View>
      ) : null}

      <Button label={submitLabel} size="lg" onPress={submit} loading={pending} style={styles.full} />

      {mode === "signin" ? (
        <Button
          label={resetMode ? "Back to Sign In" : "Forgot password?"}
          variant="ghost"
          size="sm"
          onPress={() => {
            setResetMode((r) => !r);
            setFieldErrors({});
            setFormError(null);
          }}
        />
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={[styles.or, { color: colors.subtle }]}>OR</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      <Button label="Continue as Guest (Local Only)" icon="flash-outline" variant="outline" onPress={onGuest} />
      <Text style={[styles.fine, { color: colors.subtle }]}>
        Guest drafts stay on this device. Sign in later and they move into your cloud account automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14 },
  full: { alignSelf: "stretch" },
  resetHead: { gap: 4 },
  resetTitle: { fontFamily: Fonts.bold, fontSize: 18 },
  resetSub: { fontFamily: Fonts.regular, fontSize: 13.5 },
  errorBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18 },
  divider: { flexDirection: "row", alignItems: "center", gap: 10 },
  line: { flex: 1, height: 1 },
  or: { fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 1 },
  fine: { fontFamily: Fonts.regular, fontSize: 12, textAlign: "center", lineHeight: 17 },
  notice: { alignItems: "center", gap: 12, paddingVertical: 12 },
  noticeIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  noticeTitle: { fontFamily: Fonts.bold, fontSize: 20 },
  noticeMsg: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
