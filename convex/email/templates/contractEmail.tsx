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
  Button,
} from "@react-email/components";
import { sendEmail } from "..";
import { SITE_URL } from "../../env";

interface ContractSentEmailOptions {
  clientName: string;
  clientEmail: string;
  contractTitle: string;
  viewUrl: string;
}

interface ContractSignedNotificationOptions {
  ownerEmail: string;
  clientName: string;
  contractTitle: string;
}

export function ContractSentEmail({ clientName, contractTitle, viewUrl }: ContractSentEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Contract: {contractTitle}</Preview>
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
            A contract has been prepared for your review: <strong>{contractTitle}</strong>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Please review the terms and sign the agreement at your convenience.
          </Text>
          <Button
            href={viewUrl}
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Review & Sign Contract
          </Button>
          <Text style={{ fontSize: "16px", lineHeight: "26px", marginTop: "20px" }}>
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

export function ContractSignedNotification({ clientName, contractTitle }: ContractSignedNotificationOptions) {
  return (
    <Html>
      <Head />
      <Preview>Contract Signed: {contractTitle}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Great news! {clientName} has signed the contract "{contractTitle}".
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

// Senders
export async function sendContractSentEmail(args: ContractSentEmailOptions) {
  const html = render(<ContractSentEmail {...args} />);
  await sendEmail({
    to: args.clientEmail,
    subject: `Contract: ${args.contractTitle}`,
    html,
  });
}

export async function sendContractSignedNotification(args: ContractSignedNotificationOptions) {
  const html = render(<ContractSignedNotification {...args} />);
  await sendEmail({
    to: args.ownerEmail,
    subject: `Contract Signed: ${args.contractTitle}`,
    html,
  });
}
