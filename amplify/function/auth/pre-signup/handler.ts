import { PreSignUpTriggerHandler } from "aws-lambda";

export const handler: PreSignUpTriggerHandler = async (event) => {
    try {
        const email = event.request.userAttributes['email'];

        // Check if email exists
        if (!email) {
            throw new Error("Email is required for sign-up");
        }

        // Extract and normalize domain
        const emailParts = email.split('@');
        if (emailParts.length !== 2) {
            throw new Error("Invalid email format");
        }

        const domain = emailParts[1].toLowerCase();

        // Define allowed domains
        const allowedDomains = [
            'omniscience',
            'mass',
            'sb-plant.com'
        ];

        // Check if domain matches any allowed domain
        const isDomainAllowed = allowedDomains.some(allowedDomain =>
            domain.includes(allowedDomain.toLowerCase())
        );

        if (isDomainAllowed) {

            return event;
        } else {
            // Reject sign-up with a user-friendly error
            throw new Error("Only company email addresses (@omniscience, @mass, or @sb-plant.com domains) are allowed for sign-up.");
        }

    } catch (error) {
        console.error('Pre-sign-up error:', error);
        // Re-throw the error to prevent sign-up
        throw error;
    }
};