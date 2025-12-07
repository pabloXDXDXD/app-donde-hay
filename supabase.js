// Minimal mock Supabase client for UI testing purposes
(function() {
    window.supabase = {
        createClient: function(url, key) {
            return {
                auth: {
                    getSession: async function() {
                        return { 
                            data: { 
                                session: {
                                    access_token: 'mock_token',
                                    user: { id: 'mock_user_id' }
                                } 
                            } 
                        };
                    },
                    onAuthStateChange: function(callback) {
                        return { data: { subscription: { unsubscribe: function() {} } } };
                    },
                    signInWithPassword: async function(credentials) {
                        return { error: null, data: {} };
                    },
                    signUp: async function(credentials) {
                        return { error: null, data: {} };
                    },
                    signOut: async function() {
                        return { error: null };
                    }
                },
                from: function(table) {
                    return {
                        select: function(columns) {
                            return this;
                        },
                        eq: function(column, value) {
                            return this;
                        },
                        maybeSingle: async function() {
                            return { data: null, error: null };
                        },
                        order: function(column, options) {
                            return this;
                        },
                        insert: async function(data) {
                            return { error: null, data: data };
                        },
                        update: async function(data) {
                            return { error: null, data: data };
                        },
                        delete: async function() {
                            return { error: null };
                        }
                    };
                }
            };
        }
    };
})();
