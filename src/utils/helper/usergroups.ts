import { generateClient } from 'aws-amplify/data';
import type { Schema } from "amplify/data/resource";
import { fetchUserAttributes } from 'aws-amplify/auth';
import type { AllUserInfo, UserDataResponse, UserInfo } from '@/types/user.types';



export async function getCurrentUserInfo(): Promise<UserDataResponse> {
    const defaultResponse: UserDataResponse = {
        currentUser: {
            username: '',
            email: '',
            name: '',
            isAdmin: false
        },
        allUsers: []
    };

    try {
        // 1. Get current user attributes
        const userAttributes = await fetchUserAttributes();
        const currentEmail = userAttributes.email?.toLowerCase().trim() || '';

        // 2. Fetch all users from Lambda/Cognito
        const client = generateClient<Schema>();
        const { data: usersList } = await client.queries.usersList();

        if (!usersList || !currentEmail) {
            return defaultResponse;
        }

        // 3. Parse all users and find current user
        const users = Array.isArray(usersList) ? usersList : [];
        let currentUserInfo: UserInfo = defaultResponse.currentUser;

        const uniqueUsers = [];
        const seenEmails = new Set();

        for (const userStr of users) {
            const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;

            const emailAttr = user.Attributes?.find((a: any) => a.Name === 'email');
            const userEmail = emailAttr?.Value?.toLowerCase().trim() || '';

            // Skip if we've already seen this email
            if (seenEmails.has(userEmail)) {
                continue;
            }

            seenEmails.add(userEmail);

            // Rest of your code...
            const nameAttr = user.Attributes?.find((a: any) => a.Name === 'preferred_username');
            const userName = nameAttr?.Value || '';

            const isAdmin = (user.Groups || []).some((g: any) =>
                String(g).toUpperCase().includes('ADMIN')
            );

            const userInfo: AllUserInfo = {
                username: user.Username,
                email: userEmail,
                name: userName,
                isAdmin: isAdmin,
                groups: user.Groups || []
            };

            uniqueUsers.push(userInfo);

            if (userEmail === currentEmail) {
                currentUserInfo = {
                    username: user.Username,
                    email: currentEmail,
                    name: userAttributes.preferred_username || userName,
                    isAdmin: isAdmin
                };
            }
        }

        // Use uniqueUsers instead of allUsers
        return {
            currentUser: currentUserInfo,
            allUsers: uniqueUsers
        };

    } catch (error) {
        console.error('Error fetching user data:', error);
        return defaultResponse;
    }
}