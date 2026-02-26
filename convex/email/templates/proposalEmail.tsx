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

interface ProposalSentEmailOptions {
  clientName: string;
  clientEmail: string;
  proposalTitle: string;
  totalValue: string;
  validUntil: string;
  viewUrl: string;
}

interface ProposalAcceptedNotificationOptions {
  ownerEmail: string;
  clientName: string;
  proposalTitle: string;
}

export function ProposalSentEmail({ clientName, proposalTitle, totalValue, validUntil, viewUrl }: ProposalSentEmailOptions) {
  return (
    <Html>
      <Head />
      <Preview>Proposal: {proposalTitle}</Preview>
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
            We've prepared a proposal for you: <strong>{proposalTitle}</strong>
          </Text>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            <strong>Total Value:</strong> {totalValue}
            <br />
            <strong>Valid Until:</strong> {validUntil}
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
            View Proposal
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

export function ProposalAcceptedNotification({ clientName, proposalTitle }: ProposalAcceptedNotificationOptions) {
  return (
    <Html>
      <Head />
      <Preview>Proposal Accepted: {proposalTitle}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          fontFamily:
            '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
        }}
      >
        <Container style={{ margin: "0 auto", padding: "20px 0 48px" }}>
          <Text style={{ fontSize: "16px", lineHeight: "26px" }}>
            Great news! {clientName} has accepted the proposal "{proposalTitle}".
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
export function renderProposalSentEmail(args: ProposalSentEmailOptions) {
  return render(<ProposalSentEmail {...args} />);
}

// Senders
export async function sendProposalSentEmail(args: ProposalSentEmailOptions) {
  const html = renderProposalSentEmail(args);
  await sendEmail({
    to: args.clientEmail,
    subject: `Proposal: ${args.proposalTitle}`,
    html,
  });
}

export async function sendProposalAcceptedNotification(args: ProposalAcceptedNotificationOptions) {
  const html = render(<ProposalAcceptedNotification {...args} />);
  await sendEmail({
    to: args.ownerEmail,
    subject: `Proposal Accepted: ${args.proposalTitle}`,
    html,
  });
}
