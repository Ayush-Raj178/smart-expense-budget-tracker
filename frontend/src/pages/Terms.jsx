import LegalDocument from '@/components/LegalDocument';

const sections = [
  { heading: 'Using SmartBudget', paragraphs: ['SmartBudget is a personal expense and budget tracking service. You may use it to record financial activity, organize categories, set monthly limits, and receive budget alerts. It is an organizational tool and does not provide banking, investment, tax, accounting, or legal advice.', 'You must provide accurate account information, keep your password and verification codes confidential, and promptly tell us if you believe your account has been accessed without permission.'] },
  { heading: 'Acceptable use', paragraphs: ['You may not misuse the service, attempt to access another person’s account, interfere with service availability, probe security controls, upload unlawful content, or use automated traffic that unreasonably burdens the system.'] },
  { heading: 'Your data', paragraphs: ['You retain responsibility for the expense, budget, category, and profile information you enter. You grant us permission to process that data only as needed to operate, secure, maintain, and improve SmartBudget, as described in the Privacy Policy.'] },
  { heading: 'Availability and changes', paragraphs: ['We aim to keep SmartBudget reliable, but the service may occasionally be unavailable for maintenance, failures, or circumstances outside our control. Features may change as the product develops. We will provide reasonable notice when a material change affects these terms.'] },
  { heading: 'No financial advice and limitation of liability', paragraphs: ['Budget calculations and alerts depend on the data available to the service and may be delayed or incomplete. Do not rely on SmartBudget as the sole basis for a financial decision. To the fullest extent permitted by law, SmartBudget is provided without warranties and we are not liable for indirect, incidental, special, or consequential losses arising from use of the service.'] },
  { heading: 'Suspension and termination', paragraphs: ['You may stop using SmartBudget at any time. We may restrict or terminate access when necessary to protect users or the service, respond to legal requirements, or address a serious violation of these terms.'] },
  { heading: 'Questions', paragraphs: ['Questions about these terms can be sent to the service contact address shown in the application. These placeholder terms should be reviewed by qualified counsel before SmartBudget is offered commercially or in additional jurisdictions.'] },
];

const Terms = () => <LegalDocument title="Terms of Service" intro="These terms explain the rules for using SmartBudget and the responsibilities that come with maintaining an account." sections={sections} />;
export default Terms;
