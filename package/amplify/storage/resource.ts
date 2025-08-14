import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
    name: 'IS01',
    access: (allow) => ({
        // 'profile-pictures/{entity_id}/*': [
        //     allow.guest.to(['read']),
        //     allow.entity('identity').to(['read', 'write', 'delete'])
        // ],
        'public-data/*': [
            allow.authenticated.to(['read', 'write']),
            allow.guest.to(['read', 'write'])
        ]
    }),
});