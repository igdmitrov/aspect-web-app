const express = require('express');
const axios = require('axios');
const router = express.Router();

// Auth middleware for API routes
const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
};

// Config endpoint (no auth required for base URL)
router.get('/config', (req, res) => {
    res.json({
        aspectPortalUrl: process.env.ASPECT_BASE_URL
    });
});

// Apply auth to all API routes below
router.use(requireAuth);

// Helper function to call AspectCTRM webservice
async function callAspectWS(endpoint, authHeader) {
    const baseUrl = process.env.ASPECT_BASE_URL;
    const wsPath = process.env.ASPECT_WEBSERVICE_PATH;
    
    const response = await axios.get(`${baseUrl}${wsPath}${endpoint}`, {
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
        },
        timeout: 180000 // 3 minutes
    });
    
    return response.data;
}

// Helper function to POST to AspectCTRM webservice
async function postAspectWS(endpoint, authHeader, data) {
    const baseUrl = process.env.ASPECT_BASE_URL;
    const wsPath = process.env.ASPECT_WEBSERVICE_PATH;
    
    const response = await axios.post(`${baseUrl}${wsPath}${endpoint}`, data, {
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        timeout: 60000
    });
    
    return response.data;
}

// Get all invoices
router.get('/invoices', async (req, res) => {
    try {
        const data = await callAspectWS('/getInvoices', req.session.user.authHeader);
        res.json(data);
    } catch (error) {
        console.error('Error fetching invoices:', error.message);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Get open/unpaid invoices only (optimized)
// Uses getOpenInvoices webservice, falls back to filtering getInvoices
router.get('/invoices/open', async (req, res) => {
    try {
        // Try optimized getOpenInvoices webservice first
        try {
            const data = await callAspectWS('/getOpenInvoices', req.session.user.authHeader);
            console.log(`Loaded ${Array.isArray(data) ? data.length : 0} open invoices from getOpenInvoices`);
            return res.json(data);
        } catch (err) {
            // Fallback to getInvoices with client-side filter
            if (err.response?.status === 404) {
                console.log('getOpenInvoices not found, falling back to getInvoices with filter...');
                const data = await callAspectWS('/getInvoices', req.session.user.authHeader);
                const unpaid = data.filter(inv => Math.abs(inv.invoiceBalance) > 0.01);
                console.log(`Filtered ${unpaid.length} open invoices from ${data.length} total`);
                return res.json(unpaid);
            }
            throw err;
        }
    } catch (error) {
        console.error('Error fetching open invoices:', error.message);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Legacy route - redirect to /invoices/open
router.get('/invoices/unpaid', async (req, res) => {
    try {
        const data = await callAspectWS('/getInvoices', req.session.user.authHeader);
        const unpaid = data.filter(inv => Math.abs(inv.invoiceBalance) > 0.01);
        res.json(unpaid);
    } catch (error) {
        console.error('Error fetching invoices:', error.message);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// Get all payments
// Try getPayments first, fallback to extracting from getMoneyAllocation
router.get('/payments', async (req, res) => {
    try {
        // Try dedicated getPayments webservice first
        try {
            const data = await callAspectWS('/getPayments', req.session.user.authHeader);
            return res.json(data);
        } catch (err) {
            // If getPayments doesn't exist (404), extract from allocations
            if (err.response?.status === 404) {
                console.log('getPayments not found, extracting from allocations...');
                const allocations = await callAspectWS('/getMoneyAllocation', req.session.user.authHeader);
                
                // Extract unique payments from allocations
                const paymentsMap = new Map();
                allocations.forEach(alloc => {
                    if (alloc.paymentId && !paymentsMap.has(alloc.paymentId)) {
                        paymentsMap.set(alloc.paymentId, {
                            paymentId: alloc.paymentId,
                            paymentName: alloc.paymentId,
                            reference: alloc.paymentReference || '',
                            amount: alloc.paymentAmount || 0,
                            currency: alloc.paymentCurrency || alloc.currency || '',
                            state: alloc.paymentState || '',
                            valueDate: alloc.paymentValueDate,
                            paymentOrderDate: alloc.paymentOrderDate,
                            isIncoming: alloc.paymentIsIncoming || false,
                            isInternal: alloc.paymentIsInternal || false,
                            isConfirmed: alloc.paymentIsConfirmed || false,
                            counterpartyName: alloc.counterpartyName || '',
                            companyName: alloc.companyName || '',
                            bankAccountName: alloc.bankAccountName || '',
                            unallocatedAmount: 0, // Will need manual calculation
                            allocationCount: 1
                        });
                    }
                });
                
                return res.json(Array.from(paymentsMap.values()));
            }
            throw err;
        }
    } catch (error) {
        console.error('Error fetching payments:', error.message);
        res.status(500).json({ error: 'Failed to fetch payments: ' + error.message });
    }
});

// Get open/unallocated payments (optimized)
// Uses getOpenPayments webservice, falls back to filtering getPayments
router.get('/payments/open', async (req, res) => {
    try {
        // Try optimized getOpenPayments webservice first
        try {
            const data = await callAspectWS('/getOpenPayments', req.session.user.authHeader);
            console.log(`Loaded ${Array.isArray(data) ? data.length : 0} open payments from getOpenPayments`);
            return res.json(data);
        } catch (err) {
            // Fallback to getPayments with client-side filter
            if (err.response?.status === 404) {
                console.log('getOpenPayments not found, falling back to getPayments with filter...');
                const data = await callAspectWS('/getPayments', req.session.user.authHeader);
                const unallocated = data.filter(pmt => Math.abs(pmt.unallocatedAmount) > 0.01);
                console.log(`Filtered ${unallocated.length} open payments from ${data.length} total`);
                return res.json(unallocated);
            }
            throw err;
        }
    } catch (error) {
        console.error('Error fetching open payments:', error.message);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Legacy route
router.get('/payments/unallocated', async (req, res) => {
    try {
        const data = await callAspectWS('/getPayments', req.session.user.authHeader);
        const unallocated = data.filter(pmt => Math.abs(pmt.unallocatedAmount) > 0.01);
        res.json(unallocated);
    } catch (error) {
        console.error('Error fetching payments:', error.message);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// Get money allocations
router.get('/allocations', async (req, res) => {
    try {
        const data = await callAspectWS('/getMoneyAllocation', req.session.user.authHeader);
        res.json(data);
    } catch (error) {
        console.error('Error fetching allocations:', error.message);
        res.status(500).json({ error: 'Failed to fetch allocations' });
    }
});

// Create allocation
router.post('/allocations', async (req, res) => {
    try {
        const { invoiceId, paymentId, amount } = req.body;
        
        if (!invoiceId || !paymentId || !amount) {
            return res.status(400).json({ error: 'invoiceId, paymentId, and amount are required' });
        }

        const data = await postAspectWS('/createAllocation', req.session.user.authHeader, {
            invoiceId,
            paymentId,
            amount
        });
        
        res.json(data);
    } catch (error) {
        console.error('Error creating allocation:', error.message);
        res.status(500).json({ error: 'Failed to create allocation: ' + error.message });
    }
});

// Delete allocation
router.delete('/allocations/:id', async (req, res) => {
    try {
        const data = await postAspectWS('/deleteAllocation', req.session.user.authHeader, {
            allocationId: req.params.id
        });
        res.json(data);
    } catch (error) {
        console.error('Error deleting allocation:', error.message);
        res.status(500).json({ error: 'Failed to delete allocation' });
    }
});

// Get counterparties
router.get('/counterparties', async (req, res) => {
    try {
        const data = await callAspectWS('/getCounterparties', req.session.user.authHeader);
        res.json(data);
    } catch (error) {
        console.error('Error fetching counterparties:', error.message);
        res.status(500).json({ error: 'Failed to fetch counterparties' });
    }
});

// Get companies
router.get('/companies', async (req, res) => {
    try {
        const data = await callAspectWS('/getCompanies', req.session.user.authHeader);
        res.json(data);
    } catch (error) {
        console.error('Error fetching companies:', error.message);
        res.status(500).json({ error: 'Failed to fetch companies' });
    }
});

module.exports = router;
