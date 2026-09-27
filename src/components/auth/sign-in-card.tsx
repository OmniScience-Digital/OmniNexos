import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { SignInFlow } from "@/types/schema";
import { signIn, signInWithRedirect, confirmSignIn } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAuth } from "@/contexts/auth-context";

interface SignInCardProps {
  setState: (state: SignInFlow) => void;
}

const validationSchema = Yup.object({
  email: Yup.string()
    .email("Invalid email address")
    .required("Email is required"),
  password: Yup.string().required("Password is required"),
});

const newPasswordSchema = Yup.object({
  newPassword: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("New password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords must match")
    .required("Please confirm your password"),
});

export const SignInCard = ({ setState }: SignInCardProps) => {
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Invited users (created via admin AdminCreateUser) sign in with a
  // temporary password and Cognito forces them to pick a new one before
  // sign-in completes — this state renders that second step in place of
  // the normal email/password form.
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  // ✅ Hub listener — fires AFTER Amplify fully commits the session
  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      switch (payload.event) {
        case "signedIn":
          checkAuth()
            .then(() => navigate("/landing"))
            .catch(console.error);
          break;
        case "signInWithRedirect":
          checkAuth()
            .then(() => navigate("/landing"))
            .catch(console.error);
          break;
        case "signInWithRedirect_failure":
          setError("Google sign in failed. Please try again.");
          setIsSubmitting(false);
          break;
      }
    });

    return () => unsubscribe(); // ✅ cleanup on unmount
  }, [navigate, checkAuth]);

  const formik = useFormik({
    initialValues: {
      email: "",
      password: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setError(null);
      setIsSuccess(false);
      try {
        const { isSignedIn, nextStep } = await signIn({
          username: values.email,
          password: values.password,
        });

        if (isSignedIn) {
          setIsSuccess(true);
          // ✅ Don't navigate here — Hub 'signedIn' event handles it
        } else if (nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
          // Invited user's first login — they must set their own password
          // before sign-in can complete.
          setPendingEmail(values.email);
          setNeedsNewPassword(true);
          setIsSubmitting(false);
        } else {
          console.log("Sign in requires additional steps:", nextStep);
          setIsSubmitting(false);
        }
      } catch (err: any) {
        console.error("Error signing in:", err);
        setError(err.message || "Invalid email or password");
        setIsSubmitting(false);
      }
    },
  });

  const newPasswordFormik = useFormik({
    initialValues: {
      newPassword: "",
      confirmPassword: "",
    },
    validationSchema: newPasswordSchema,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const { isSignedIn, nextStep } = await confirmSignIn({
          challengeResponse: values.newPassword,
        });

        if (isSignedIn) {
          setIsSuccess(true);
          // ✅ Hub 'signedIn' event handles navigation
        } else {
          console.log("Sign in requires additional steps:", nextStep);
          setIsSubmitting(false);
        }
      } catch (err: any) {
        console.error("Error setting new password:", err);
        setError(err.message || "Failed to set new password");
        setIsSubmitting(false);
      }
    },
  });

  const handleGoogleSignIn = async () => {
    await signInWithRedirect({
      provider: "Google",
      options: {
        prompt: "SELECT_ACCOUNT",
      },
    });
  };

  if (needsNewPassword) {
    return (
      <Card className="w-full h-full px-8 py-6">
        <div className="flex items-center w-full justify-center">
          <img
            src="/assets/logo.png"
            alt="Logo"
            className="h-13 w-auto mr-2"
            loading="eager"
            decoding="async"
          />
        </div>

        <CardHeader className="px-0 my-5">
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Welcome, {pendingEmail}. Please set a new password to continue.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 px-0 pb-0">
          {error && (
            <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
              {error}
            </div>
          )}

          {isSuccess && (
            <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span>Sign in successful! Redirecting...</span>
            </div>
          )}

          <form onSubmit={newPasswordFormik.handleSubmit} className="space-y-2.5">
            <div>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="New password"
                onChange={newPasswordFormik.handleChange}
                onBlur={newPasswordFormik.handleBlur}
                value={newPasswordFormik.values.newPassword}
                disabled={isSubmitting || isSuccess}
              />
              {newPasswordFormik.touched.newPassword && newPasswordFormik.errors.newPassword && (
                <div className="text-red-500 text-xs mt-1">
                  {newPasswordFormik.errors.newPassword}
                </div>
              )}
            </div>

            <div>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                onChange={newPasswordFormik.handleChange}
                onBlur={newPasswordFormik.handleBlur}
                value={newPasswordFormik.values.confirmPassword}
                disabled={isSubmitting || isSuccess}
              />
              {newPasswordFormik.touched.confirmPassword && newPasswordFormik.errors.confirmPassword && (
                <div className="text-red-500 text-xs mt-1">
                  {newPasswordFormik.errors.confirmPassword}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || isSuccess || !newPasswordFormik.isValid}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                "Set Password & Continue"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full px-8 py-6">
      <div className="flex items-center w-full justify-center">
        <img
          src="/assets/logo.png"
          alt="Logo"
          className="h-13 w-auto mr-2"
          loading="eager"
          decoding="async"
        />
      </div>

      <CardHeader className="px-0  my-5">
        <CardTitle>Login to continue</CardTitle>
        <CardDescription>NB: Only Company domains are accepted</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-0 pb-0">
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-md flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span>Sign in successful! Redirecting...</span>
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-2.5">
          <div>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Email"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.email}
              disabled={isSubmitting || isSuccess}
            />
            {formik.touched.email && formik.errors.email && (
              <div className="text-red-500 text-xs mt-1">
                {formik.errors.email}
              </div>
            )}
          </div>

          <div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.password}
              disabled={isSubmitting || isSuccess}
            />
            {formik.touched.password && formik.errors.password && (
              <div className="text-red-500 text-xs mt-1">
                {formik.errors.password}
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || isSuccess}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSuccess ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              "Continue"
            )}
          </Button>
        </form>

        <Separator />
        <div className="flex flex-col gap-y-2.5">
          <Button
            id="googleSignInButton"
            disabled={isSubmitting || isSuccess}
            onClick={handleGoogleSignIn}
            variant="outline"
            size="lg"
            className="w-full relative"
          >
            <FcGoogle className="size-5 absolute top-3 left-2.5" />
            Continue with Google
          </Button>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <span
              onClick={() => !isSubmitting && !isSuccess && setState("signUp")}
              className="text-sky-700 hover:underline cursor-pointer"
            >
              Sign up
            </span>
          </p>

          <p className="text-xs text-muted-foreground">
            Forgot your password?{" "}
            <span
              onClick={() =>
                !isSubmitting && !isSuccess && setState("forgotPassword")
              }
              className="text-sky-700 hover:underline cursor-pointer"
            >
              Reset it
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};