import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/card";
import {
  Scale,
  Shield,
  AlertTriangle,
  RefreshCw,
  Users,
  FileText,
} from "lucide-react";

export const Route = createFileRoute("/_app/_auth/terms")({
  component: TermsOfService,
  beforeLoad: () => ({
    title: "Terms of Service",
    headerTitle: "Terms of Service",
    headerDescription: "Terms and conditions for using our service.",
  }),
});

function TermsOfService() {
  const lastUpdated = "February 3, 2026";

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground">
          These terms govern your use of our AI-powered SaaS platform.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Acceptance of Terms
            </CardTitle>
            <CardDescription>
              By using our service, you agree to these terms and conditions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              By accessing and using Modern Phase's AI-powered SaaS platform
              ("the Service"), you accept and agree to be bound by these Terms
              of Service. If you do not agree to these terms, you may not use
              the Service.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Service Description
            </CardTitle>
            <CardDescription>
              We provide an AI-powered platform for document management and chat
              interactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold">Services Include</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Document upload and storage</li>
                <li>• AI-powered chat interactions</li>
                <li>• Document analysis and retrieval</li>
                <li>• User account management</li>
                <li>• Subscription-based billing</li>
              </ul>
            </div>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                The Service is provided "as is" and we reserve the right to
                modify, suspend, or discontinue the Service at any time.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Accounts and Responsibilities
            </CardTitle>
            <CardDescription>
              You are responsible for maintaining the security of your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Account Security</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>
                    • You must provide accurate information during registration
                  </li>
                  <li>
                    • You are responsible for safeguarding your credentials
                  </li>
                  <li>
                    • You must notify us immediately of unauthorized access
                  </li>
                  <li>
                    • You are responsible for all activities under your account
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold">Acceptable Use</h4>
                <p className="text-sm text-muted-foreground">
                  You agree to use the Service only for lawful purposes and in
                  accordance with these Terms. You may not:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                  <li>
                    • Upload or share illegal, harmful, or offensive content
                  </li>
                  <li>• Attempt to gain unauthorized access to our systems</li>
                  <li>• Interfere with or disrupt the Service</li>
                  <li>• Use the Service for fraudulent purposes</li>
                  <li>• Violate applicable laws or regulations</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Intellectual Property and Content
            </CardTitle>
            <CardDescription>
              Ownership and rights related to content and intellectual property.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Your Content</h4>
                <p className="text-sm text-muted-foreground">
                  You retain ownership of the content you upload to the Service.
                  You grant us a limited, non-exclusive license to use, process,
                  and store your content solely to provide the Service.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">AI-Generated Content</h4>
                <p className="text-sm text-muted-foreground">
                  Content generated by our AI models is based on your inputs and
                  the documents you provide. You are responsible for reviewing
                  and ensuring the accuracy of AI-generated content.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Service Property</h4>
                <p className="text-sm text-muted-foreground">
                  The Service, including its technology, features, and design,
                  is the property of Modern Phase and is protected by
                  intellectual property laws.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Disclaimers and Limitations of Liability
            </CardTitle>
            <CardDescription>
              Important limitations on our liability and warranties.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">AI Service Disclaimers</h4>
                <p className="text-sm text-muted-foreground">
                  Our AI services may generate inaccurate, incomplete, or
                  inappropriate responses. You should not rely on AI-generated
                  content for critical decisions without independent
                  verification.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Service Availability</h4>
                <p className="text-sm text-muted-foreground">
                  We do not guarantee uninterrupted or error-free service. The
                  Service may be temporarily unavailable due to maintenance,
                  updates, or technical issues.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Limitation of Liability</h4>
                <p className="text-sm text-muted-foreground">
                  To the maximum extent permitted by law, Modern Phase shall not
                  be liable for any indirect, incidental, special, or
                  consequential damages arising from your use of the Service.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Subscription and Billing
            </CardTitle>
            <CardDescription>
              Terms governing subscriptions, payments, and billing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Subscription Plans</h4>
                <p className="text-sm text-muted-foreground">
                  We offer FREE and PRO subscription plans with different
                  features and usage limits. Plan features and pricing are
                  subject to change.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Payment Terms</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Payments are processed securely through Stripe</li>
                  <li>• Subscriptions are billed monthly or annually</li>
                  <li>• You can cancel your subscription at any time</li>
                  <li>• Refunds are handled on a case-by-case basis</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold">Usage Limits</h4>
                <p className="text-sm text-muted-foreground">
                  Each subscription plan has specific usage limits. Exceeding
                  these limits may result in additional charges or service
                  restrictions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Privacy and Data Protection
            </CardTitle>
            <CardDescription>
              How we handle your data in accordance with privacy laws.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your privacy is important to us. Our collection and use of
              personal information is governed by our Privacy Policy, which
              forms part of these Terms. We comply with applicable data
              protection laws, including GDPR.
            </p>
            <div className="mt-3 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                By using our Service, you consent to the collection and use of
                your information as described in our Privacy Policy.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Term and Termination</CardTitle>
            <CardDescription>
              How these terms can be modified and terminated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Term</h4>
                <p className="text-sm text-muted-foreground">
                  These Terms remain in effect as long as you use the Service.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Termination</h4>
                <p className="text-sm text-muted-foreground">
                  You may terminate your account at any time. We may suspend or
                  terminate your account for violations of these Terms or for
                  any other reason at our discretion.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Effect of Termination</h4>
                <p className="text-sm text-muted-foreground">
                  Upon termination, your right to use the Service ceases
                  immediately. We will delete your account and data upon your
                  request in accordance with our privacy policy.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Governing Law and Dispute Resolution</CardTitle>
            <CardDescription>
              Legal framework for resolving disputes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold">Governing Law</h4>
                <p className="text-sm text-muted-foreground">
                  These Terms are governed by the laws of the jurisdiction where
                  Modern Phase operates, without regard to conflict of law
                  principles.
                </p>
              </div>
              <div>
                <h4 className="font-semibold">Dispute Resolution</h4>
                <p className="text-sm text-muted-foreground">
                  Any disputes arising from these Terms or your use of the
                  Service will be resolved through good faith negotiation and,
                  if necessary, through binding arbitration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
            <CardDescription>
              How to reach us with questions about these terms.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Email:</strong> legal@modernphase.app
              </p>
              <p>
                <strong>Address:</strong> Modern Phase, [Address]
              </p>
              <p>
                <strong>Support:</strong> support@modernphase.app
              </p>
            </div>
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm">
                For questions about these Terms of Service, please contact our
                legal team at the email address above.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
