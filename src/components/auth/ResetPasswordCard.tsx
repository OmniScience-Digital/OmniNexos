// ResetPasswordCard.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormik } from "formik";
import * as Yup from "yup";
import { confirmResetPassword } from "aws-amplify/auth";
import type { SignInFlow } from "@/types/schema";
import { useState } from "react";

interface ResetPasswordCardProps {
    email: string;
    setState: (state: SignInFlow) => void;
}

export const ResetPasswordCard = ({ email, setState }: ResetPasswordCardProps) => {
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const formik = useFormik({
        initialValues: {
            code: '',
            newPassword: '',
            confirmPassword: ''
        },
        validationSchema: Yup.object({
            code: Yup.string().required('Verification code is required'),
            newPassword: Yup.string()
                .min(8, 'Password must be at least 8 characters')
                .required('Password is required'),
            confirmPassword: Yup.string()
                .oneOf([Yup.ref('newPassword')], 'Passwords must match')
                .required('Please confirm your password')
        }),
        onSubmit: async (values) => {
            setIsSubmitting(true);
            setError(null);
            try {
                await confirmResetPassword({
                    username: email,
                    newPassword: values.newPassword,
                    confirmationCode: values.code
                });
                setSuccess(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to reset password');
            } finally {
                setIsSubmitting(false);
            }
        }
    });

    if (success) {
        return (
            <Card className="w-full h-full px-8 py-6">
                <CardHeader className="px-0 pt-3 my-5">
                    <CardTitle>Password Updated</CardTitle>
                    <CardDescription>
                        Your password has been reset successfully
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => setState('signIn')}
                    >
                        Return to Sign In
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full h-full px-8 py-6">
            <CardHeader className="px-0 pt-3 my-5">
                <CardTitle>Set New Password</CardTitle>
                <CardDescription>
                    Enter the code sent to {email} and your new password
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 px-0 pb-0">
                {error && (
                    <div className="text-red-500 text-sm p-2 bg-red-50 rounded-md">
                        {error}
                    </div>
                )}

                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <Input
                        id="code"
                        name="code"
                        type="text"
                        placeholder="Verification Code"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.code}
                        disabled={isSubmitting}
                    />
                    {formik.touched.code && formik.errors.code && (
                        <div className="text-red-500 text-xs mt-1">{formik.errors.code}</div>
                    )}

                    <Input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        placeholder="New Password"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.newPassword}
                        disabled={isSubmitting}
                    />
                    {formik.touched.newPassword && formik.errors.newPassword && (
                        <div className="text-red-500 text-xs mt-1">{formik.errors.newPassword}</div>
                    )}

                    <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        placeholder="Confirm New Password"
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        value={formik.values.confirmPassword}
                        disabled={isSubmitting}
                    />
                    {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                        <div className="text-red-500 text-xs mt-1">{formik.errors.confirmPassword}</div>
                    )}

                    <Button 
                        type="submit" 
                        className="w-full" 
                        size="lg" 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Updating...' : 'Update Password'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};