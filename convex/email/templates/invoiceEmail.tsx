/* eslint-disable react-refresh/only-export-components */
import { render } from "@react-email/render";
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import { sendEmail } from "..";
import { SITE_URL } from "../../env";

interface InvoiceSentEmailOptions {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  total: string;
  dueDate: string;
}

interface InvoicePaidEmailOptions {
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  total: string;
}

export function InvoiceSentEmail({ clientName, invoiceNumber, total, dueDate }: InvoiceSentEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Invoice {invoiceNumber} from Modern Phase</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {clientName},
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            You have a new invoice from Modern Phase.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Invoice:</strong> {invoiceNumber}
            <br />
            <strong>Amount:</strong> {total}
            <br />
            <strong>Due Date:</strong> {dueDate}
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Please remit payment at your earliest convenience.
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={SITE_URL}>Modern Phase</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            Modern Phase
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function InvoicePaidEmail({ clientName, invoiceNumber, total }: InvoicePaidEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Payment received for {invoiceNumber}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Hello {clientName},
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            We've received your payment of {total} for invoice {invoiceNumber}.
            <br />
            Thank you for your business!
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            The <Link href={SITE_URL}>Modern Phase</Link> team.
          </Text>
          <Hr style={{ borderColor: "#cccccc", margin: "20px 0" }} />
          <Text style={{ color: "#8898aa", fontSize: "12px" }}>
            Modern Phase
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Renders
export function renderInvoiceSentEmail(args: InvoiceSentEmailOptions) {
  return render(<InvoiceSentEmail {...args} />);
}

export function renderInvoicePaidEmail(args: InvoicePaidEmailOptions) {
  return render(<InvoicePaidEmail {...args} />);
}

// Senders
export async function sendInvoiceSentEmail(args: InvoiceSentEmailOptions) {
  const html = renderInvoiceSentEmail(args);
  await sendEmail({
    to: args.clientEmail,
    subject: `Invoice ${args.invoiceNumber} from Modern Phase`,
    html,
  });
}

export async function sendInvoicePaidEmail(args: InvoicePaidEmailOptions) {
  const html = renderInvoicePaidEmail(args);
  await sendEmail({
    to: args.clientEmail,
    subject: `Payment received — ${args.invoiceNumber}`,
    html,
  });
}
