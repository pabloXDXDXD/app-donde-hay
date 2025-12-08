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
                            this._table = table;
                            return this;
                        },
                        eq: function(column, value) {
                            this._eq_column = column;
                            this._eq_value = value;
                            return this;
                        },
                        maybeSingle: async function() {
                            // Return mock store data for testing
                            if (this._table === 'store_requests') {
                                return { 
                                    data: {
                                        id: 1,
                                        user_id: 'mock_user_id',
                                        business_name: 'Mi Tienda de Prueba',
                                        business_type: 'Restaurante',
                                        phone: '555-1234',
                                        email: 'test@example.com',
                                        address: 'Calle Principal 123',
                                        status: 'approved'
                                    }, 
                                    error: null 
                                };
                            }
                            return { data: null, error: null };
                        },
                        order: async function(column, options) {
                            // Return mock products data for testing
                            if (this._table === 'products') {
                                return { 
                                    data: [
                                        {
                                            id: 1,
                                            store_id: 1,
                                            name: 'Hamburguesa',
                                            price: 50.00,
                                            category: 'Comida Rápida'
                                        },
                                        {
                                            id: 2,
                                            store_id: 1,
                                            name: 'Pizza',
                                            price: 120.00,
                                            category: 'Comida Italiana'
                                        },
                                        {
                                            id: 3,
                                            store_id: 1,
                                            name: 'Refresco',
                                            price: 15.00,
                                            category: 'Bebidas'
                                        }
                                    ], 
                                    error: null 
                                };
                            }
                            return { data: [], error: null };
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
