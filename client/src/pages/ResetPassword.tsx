import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const confirmResetSchema = z.object({
  newPassword: z.string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Must include at least one uppercase letter")
    .regex(/[a-z]/, "Must include at least one lowercase letter")
    .regex(/[0-9]/, "Must include at least one number")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, "Must include at least one special character"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ConfirmResetForm = z.infer<typeof confirmResetSchema>;

export default function ResetPassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const token = searchParams.get("token");

  const form = useForm<ConfirmResetForm>({
    resolver: zodResolver(confirmResetSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const confirmResetMutation = useMutation({
    mutationFn: async (data: ConfirmResetForm) => {
      return await apiRequest("POST", "/api/password-reset/confirm", {
        token,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "You can now login with your new password",
      });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Invalid or expired reset token",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConfirmResetForm) => {
    if (!token) {
      toast({
        title: "Invalid link",
        description: "This password reset link is invalid",
        variant: "destructive",
      });
      return;
    }
    confirmResetMutation.mutate(data);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Invalid Link</CardTitle>
            <CardDescription className="text-center">
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button
              onClick={() => setLocation("/forgot-password")}
              className="bg-[#17B6C3] hover:bg-[#1396A1] text-white"
            >
              Request New Link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/80 backdrop-blur-sm border-white/50 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Set new password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-new-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="••••••••"
                        className="bg-white/70 border-gray-200/30"
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full bg-[#17B6C3] hover:bg-[#1396A1] text-white"
                disabled={confirmResetMutation.isPending}
                data-testid="button-reset-password"
              >
                {confirmResetMutation.isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
