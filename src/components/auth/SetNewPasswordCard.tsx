// src/components/auth/SetNewPasswordCard.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmSignIn } from "aws-amplify/auth";
import { useFormik } from "formik";
import * as Yup from "yup";

interface SetNewPasswordCardProps {
  email: string;
  onComplete: () => void; // called once the new password is set and sign-in completes
}

interface FormValues {
  newPassword: string;
  confirmPassword: string;
}

const validationSchema = Yup.object({
  newPassword: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("New password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("newPassword")], "Passwords must match")
    .required("Please confirm your password"),
});

export const SetNewPasswordCard = ({ email, onComplete }: SetNewPasswordCardProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formik = useFormik<FormValues>({
    initialValues: { newPassword: "", confirmPassword: "" },
    validationSchema,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const result = await confirmSignIn({
          challengeResponse: values.newPassword,
        });

        if (result.isSignedIn) {
          onComplete();
        } else {
          // Some pools also require additional attributes on first login
          // (e.g. preferred_username) — if so, this step's nextStep will
          // indicate that instead of isSignedIn. Extend here if you hit
          // that case.
          setError("Additional steps are required to complete sign-in.");
        }
      } catch (err) {
        console.error("Error setting new password:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <Card className="w-full h-full px-8 py-6">
      <CardHeader className="px-0 pt-3 my-5">
        <CardTitle>Set your password</CardTitle>
        <CardDescription>
          Welcome, {email}. Please set a new password to continue.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 px-0 pb-0">
        {error && (
          <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-2.5">
          <div>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              placeholder="New password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.newPassword}
              disabled={isSubmitting}
            />
            {formik.touched.newPassword && formik.errors.newPassword ? (
              <div className="text-red-500 text-xs mt-1">
                {formik.errors.newPassword}
              </div>
            ) : null}
          </div>

          <div>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.confirmPassword}
              disabled={isSubmitting}
            />
            {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
              <div className="text-red-500 text-xs mt-1">
                {formik.errors.confirmPassword}
              </div>
            ) : null}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting || !formik.isValid}
          >
            {isSubmitting ? "Setting password..." : "Set Password & Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};