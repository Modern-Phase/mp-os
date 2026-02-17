import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import ReactMarkdown from "react-markdown";

/**
 * XSS Output Escaping Tests
 * Verifies that ReactMarkdown properly escapes XSS payloads and that
 * the custom link component validates URLs correctly
 */

// Re-implementation of the safe anchor component from ChatInterface.tsx
const safeAnchor = ({
  children,
  href,
}: {
  children?: React.ReactNode;
  href?: string;
}) => {
  const isSafe = !href || /^(https?:\/\/|mailto:|\/|#|\.)/.test(href);
  if (!isSafe) return <span className="text-primary">{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  );
};

// Minimal components map with only the security-relevant override
const testComponents = {
  a: safeAnchor,
};

describe("XSS Output Escaping", () => {
  it("should NOT render script tags as executable elements", () => {
    const payload = "<script>alert('xss')</script>";
    const { container } = render(<ReactMarkdown>{payload}</ReactMarkdown>);

    // Script tags should NOT be in the DOM
    const scriptElement = container.querySelector("script");
    expect(scriptElement).toBeNull();

    // The text should be visible as escaped content
    expect(container.textContent).toContain("<script>");
    expect(container.textContent).toContain("</script>");
  });

  it("should NOT render img onerror injection as an image element", () => {
    const payload = "<img src=x onerror=alert('xss')>";
    const { container } = render(<ReactMarkdown>{payload}</ReactMarkdown>);

    // No img element should be created from raw HTML
    const imgElement = container.querySelector("img");
    expect(imgElement).toBeNull();

    // The text should be escaped and visible
    expect(container.textContent).toContain("<img");
  });

  it("should NOT create clickable link for javascript: URLs", () => {
    const payload = "[click me](javascript:alert('xss'))";
    const { container } = render(
      <ReactMarkdown components={testComponents}>{payload}</ReactMarkdown>,
    );

    // No <a> element should exist (safeAnchor renders a span instead)
    const anchorElement = container.querySelector("a");
    expect(anchorElement).toBeNull();

    // Should render as a span with the link text
    const spanElement = container.querySelector("span");
    expect(spanElement).toBeTruthy();
    expect(spanElement?.textContent).toBe("click me");
  });

  it("should NOT create clickable link for data: URLs", () => {
    const payload = "[click me](data:text/html,<script>alert(1)</script>)";
    const { container } = render(
      <ReactMarkdown components={testComponents}>{payload}</ReactMarkdown>,
    );

    // No <a> element should exist
    const anchorElement = container.querySelector("a");
    expect(anchorElement).toBeNull();

    // Should render as a span
    const spanElement = container.querySelector("span");
    expect(spanElement).toBeTruthy();
    expect(spanElement?.textContent).toBe("click me");
  });

  it("should NOT create clickable link for vbscript: URLs", () => {
    const payload = "[click me](vbscript:msgbox)";
    const { container } = render(
      <ReactMarkdown components={testComponents}>{payload}</ReactMarkdown>,
    );

    // No <a> element should exist
    const anchorElement = container.querySelector("a");
    expect(anchorElement).toBeNull();

    // Should render as a span
    const spanElement = container.querySelector("span");
    expect(spanElement).toBeTruthy();
  });

  it("should NOT render SVG onload injection as executable", () => {
    const payload = "<svg onload=alert('xss')>";
    const { container } = render(<ReactMarkdown>{payload}</ReactMarkdown>);

    // No SVG element should be created from raw HTML
    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeNull();

    // The text should be escaped
    expect(container.textContent).toContain("<svg");
  });

  it("should allow legitimate https links with proper security attributes", () => {
    const payload = "[Google](https://google.com)";
    const { container } = render(
      <ReactMarkdown components={testComponents}>{payload}</ReactMarkdown>,
    );

    // An anchor element SHOULD exist for valid https URLs
    const anchorElement = container.querySelector("a");
    expect(anchorElement).toBeTruthy();
    expect(anchorElement?.getAttribute("href")).toBe("https://google.com");
    expect(anchorElement?.getAttribute("target")).toBe("_blank");
    expect(anchorElement?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchorElement?.textContent).toBe("Google");
  });
});
