import { fetchUserAttributes } from 'aws-amplify/auth';
import type { AllUserInfo, UserDataResponse, UserInfo } from '@/types/user.types';
import { client } from '@/services/schema';

const USER_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedResponse: UserDataResponse | null = null;
let cachedAt = 0;
let inFlight: Promise<UserDataResponse> | null = null;

export async function getCurrentUserInfo(options?: { force?: boolean }): Promise<UserDataResponse> {
    const defaultResponse: UserDataResponse = {
        currentUser: {
            username: '',
            email: '',
            name: '',
            isAdmin: false
        },
        allUsers: []
    };

    const now = Date.now();
    if (!options?.force && cachedResponse && (now - cachedAt) < USER_LIST_CACHE_TTL_MS) {
        return cachedResponse;
    }

    if (!options?.force && inFlight) {
        return inFlight;
    }

    const fetchPromise = (async (): Promise<UserDataResponse> => {
        try {
            const userAttributes = await fetchUserAttributes();
            const currentEmail = userAttributes.email?.toLowerCase().trim() || '';

            const { data: usersList } = await client.queries.usersList();

        if (!usersList || !currentEmail) {
            return defaultResponse;
        }

        const users = Array.isArray(usersList) ? usersList : [];
        let currentUserInfo: UserInfo = defaultResponse.currentUser;

        const uniqueUsers = [];
        const seenEmails = new Set();

        for (const userStr of users) {
            const user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;

            const emailAttr = user.Attributes?.find((a: any) => a.Name === 'email');
            const userEmail = emailAttr?.Value?.toLowerCase().trim() || '';

            if (seenEmails.has(userEmail)) {
                continue;
            }

            seenEmails.add(userEmail);

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
                groups: user.Groups || [],
                enabled: user.Enabled !== false,
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

            return {
                currentUser: currentUserInfo,
                allUsers: uniqueUsers
            };

        } catch (error) {
            console.error('Error fetching user data:', error);
            return defaultResponse;
        }
    })();

    inFlight = fetchPromise;
    try {
        const result = await fetchPromise;
        cachedResponse = result;
        cachedAt = Date.now();
        return result;
    } finally {
        inFlight = null;
    }
}

export function invalidateUserListCache() {
    cachedResponse = null;
    cachedAt = 0;
}