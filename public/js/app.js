// Aspect Web App - Main Application Logic

class SettlementApp {
    constructor() {
        this.invoices = [];
        this.payments = [];
        this.allocations = [];
        this.selectedInvoice = null;
        this.selectedPayment = null;
        this.counterparties = [];
        this.currencies = new Set();
        this.counterpartyChoices = null;
        
        this.init();
    }

    async init() {
        await this.loadCurrentUser();
        this.initChoices();
        this.bindEvents();
        await this.loadData();
    }

    initChoices() {
        // Initialize Choices.js for searchable counterparty dropdown
        this.counterpartyChoices = new Choices('#counterpartyFilter', {
            searchEnabled: true,
            searchPlaceholderValue: 'Type to search...',
            itemSelectText: '',
            shouldSort: true,
            placeholder: true,
            placeholderValue: 'Select counterparty',
            searchResultLimit: 20,
            noResultsText: 'No counterparties found',
            noChoicesText: 'No counterparties available'
        });
    }

    async loadCurrentUser() {
        try {
            const response = await fetch('/auth/user');
            if (response.ok) {
                const data = await response.json();
                document.getElementById('userDisplay').textContent = data.username;
            }
        } catch (error) {
            console.error('Error loading user:', error);
        }
    }

    bindEvents() {
        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
        
        // Filters
        document.getElementById('counterpartyFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('currencyFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        
        // Create Allocation
        document.getElementById('createAllocationBtn').addEventListener('click', () => this.createAllocation());
        
        // Toggle allocations
        document.getElementById('toggleAllocations').addEventListener('click', () => {
            const wrapper = document.getElementById('allocationsWrapper');
            wrapper.classList.toggle('collapsed');
        });
    }

    async logout() {
        try {
            await fetch('/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    }

    async loadData() {
        this.showLoading();
        
        try {
            const [invoicesRes, paymentsRes, allocationsRes] = await Promise.all([
                fetch('/api/invoices/open'),
                fetch('/api/payments/open'),
                fetch('/api/allocations')
            ]);

            if (!invoicesRes.ok || !paymentsRes.ok) {
                if (invoicesRes.status === 401 || paymentsRes.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error('Failed to load data');
            }

            let invoicesData = await invoicesRes.json();
            let paymentsData = await paymentsRes.json();
            let allocationsData = allocationsRes.ok ? await allocationsRes.json() : [];

            // Debug: log raw response
            console.log('Raw invoices response:', invoicesData);
            console.log('Raw payments response:', paymentsData);

            // Ensure data is always an array
            this.invoices = Array.isArray(invoicesData) ? invoicesData : (invoicesData ? [invoicesData] : []);
            this.payments = Array.isArray(paymentsData) ? paymentsData : (paymentsData ? [paymentsData] : []);
            this.allocations = Array.isArray(allocationsData) ? allocationsData : (allocationsData ? [allocationsData] : []);

            // Sort invoices by due date (ascending - oldest first)
            this.invoices.sort((a, b) => {
                const dateA = a.dueDate ? new Date(a.dueDate) : new Date(0);
                const dateB = b.dueDate ? new Date(b.dueDate) : new Date(0);
                return dateA - dateB;
            });

            // Sort payments by value date (ascending - oldest first)
            this.payments.sort((a, b) => {
                const dateA = a.valueDate ? new Date(a.valueDate) : new Date(0);
                const dateB = b.valueDate ? new Date(b.valueDate) : new Date(0);
                return dateA - dateB;
            });

            console.log('Loaded:', this.invoices.length, 'invoices,', this.payments.length, 'payments');
            if (this.invoices.length > 0) {
                console.log('First invoice:', this.invoices[0]);
            }

            this.extractFilters();
            this.applyFilters();
            this.renderAllocations();
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showMessage('Failed to load data: ' + error.message, 'error');
        }
    }

    showLoading() {
        document.getElementById('invoicesBody').innerHTML = '<tr class="loading-row"><td colspan="8">Loading invoices...</td></tr>';
        document.getElementById('paymentsBody').innerHTML = '<tr class="loading-row"><td colspan="8">Loading payments...</td></tr>';
    }

    extractFilters() {
        // Extract unique counterparties and currencies
        const counterpartySet = new Set();
        this.currencies = new Set();

        // Ensure arrays exist
        if (!Array.isArray(this.invoices)) this.invoices = [];
        if (!Array.isArray(this.payments)) this.payments = [];

        this.invoices.forEach(inv => {
            if (inv && inv.counterpartyName) counterpartySet.add(inv.counterpartyName);
            if (inv && inv.invoiceCurrency) this.currencies.add(inv.invoiceCurrency);
        });

        this.payments.forEach(pmt => {
            if (pmt && pmt.counterpartyName) counterpartySet.add(pmt.counterpartyName);
            if (pmt && pmt.currency) this.currencies.add(pmt.currency);
        });

        this.counterparties = Array.from(counterpartySet).sort();

        // Populate counterparty filter with Choices.js
        const choices = this.counterparties.map(cpty => ({ value: cpty, label: cpty }));
        this.counterpartyChoices.clearStore();
        this.counterpartyChoices.setChoices(
            [{ value: '', label: 'All Counterparties', selected: true }, ...choices],
            'value',
            'label',
            true
        );

        // Populate currency filter
        const currFilter = document.getElementById('currencyFilter');
        currFilter.innerHTML = '<option value="">All Currencies</option>';
        Array.from(this.currencies).sort().forEach(curr => {
            currFilter.innerHTML += `<option value="${curr}">${curr}</option>`;
        });
    }

    applyFilters() {
        const counterparty = document.getElementById('counterpartyFilter').value;
        const currency = document.getElementById('currencyFilter').value;
        const status = document.getElementById('statusFilter').value;

        console.log('Applying filters:', { counterparty, currency, status });
        console.log('Total invoices before filter:', this.invoices?.length || 0);
        console.log('Total payments before filter:', this.payments?.length || 0);

        // Ensure arrays exist
        if (!Array.isArray(this.invoices)) this.invoices = [];
        if (!Array.isArray(this.payments)) this.payments = [];

        // Filter invoices
        let filteredInvoices = this.invoices.filter(inv => {
            if (!inv) return false;
            if (counterparty && inv.counterpartyName !== counterparty) return false;
            if (currency && inv.invoiceCurrency !== currency) return false;
            if (status === 'open' && Math.abs(inv.invoiceBalance || 0) < 0.01) return false;
            return true;
        });

        // Filter payments
        let filteredPayments = this.payments.filter(pmt => {
            if (!pmt) return false;
            if (counterparty && pmt.counterpartyName !== counterparty) return false;
            if (currency && pmt.currency !== currency) return false;
            if (status === 'open' && Math.abs(pmt.unallocatedAmount || pmt.amount || 0) < 0.01) return false;
            return true;
        });

        console.log('Filtered invoices:', filteredInvoices.length);
        console.log('Filtered payments:', filteredPayments.length);

        this.renderInvoices(filteredInvoices);
        this.renderPayments(filteredPayments);
        
        // Hide/show Counterparty column based on filter selection
        const hideCounterparty = counterparty !== '';
        document.querySelectorAll('.col-cpty').forEach(el => {
            el.style.display = hideCounterparty ? 'none' : '';
        });
    }

    renderInvoices(invoices) {
        const tbody = document.getElementById('invoicesBody');
        document.getElementById('invoiceCount').textContent = invoices.length;
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="14">No invoices found</td></tr>';
            return;
        }

        tbody.innerHTML = invoices.map(inv => {
            const isSelected = this.selectedInvoice === inv.invoiceId;
            const direction = inv.isIncoming ? 'IN' : 'OUT';
            const dirClass = inv.isIncoming ? 'direction-in' : 'direction-out';
            const balance = inv.invoiceBalance || 0;
            const balanceClass = balance >= 0 ? 'amount-positive' : 'amount-negative';
            
            return `
                <tr class="${isSelected ? 'selected' : ''}" data-id="${inv.invoiceId}">
                    <td class="col-check">
                        <input type="radio" name="invoice-select" class="invoice-radio" data-id="${inv.invoiceId}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td class="col-id">${inv.invoiceName || '-'}</td>
                    <td class="col-ref">${inv.reference || '-'}</td>
                    <td class="col-cpty">${inv.counterpartyName || '-'}</td>
                    <td class="col-strategy">${inv.strategyName || '-'}</td>
                    <td class="col-tanker">${inv.tankerName || '-'}</td>
                    <td class="col-item">${inv.itemType || '-'}</td>
                    <td class="col-amount">${this.formatNumber(inv.amount)}</td>
                    <td class="col-balance ${balanceClass}">${this.formatNumber(balance)}</td>
                    <td class="col-curr">${inv.invoiceCurrency || '-'}</td>
                    <td class="col-date">${this.formatDate(inv.issueDate)}</td>
                    <td class="col-date">${this.formatDate(inv.dueDate)}</td>
                    <td class="col-bank">${inv.bankName || '-'}</td>
                    <td class="col-dir ${dirClass}">${direction}</td>
                </tr>
            `;
        }).join('');

        // Bind radio button events
        tbody.querySelectorAll('.invoice-radio').forEach(rb => {
            rb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                // Clear previous selection styling
                tbody.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
                // Set new selection
                this.selectedInvoice = id;
                e.target.closest('tr').classList.add('selected');
                this.updateSummary();
            });
        });

        this.updateSummary();
    }

    renderPayments(payments) {
        const tbody = document.getElementById('paymentsBody');
        document.getElementById('paymentCount').textContent = payments.length;
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="11">No payments found</td></tr>';
            return;
        }

        tbody.innerHTML = payments.map(pmt => {
            const isSelected = this.selectedPayment === pmt.paymentId;
            const direction = pmt.isIncoming ? 'IN' : 'OUT';
            const dirClass = pmt.isIncoming ? 'direction-in' : 'direction-out';
            const unallocated = pmt.unallocatedAmount !== undefined ? pmt.unallocatedAmount : pmt.amount;
            const unallocClass = unallocated >= 0 ? 'amount-positive' : 'amount-negative';
            const exchRate = pmt.exchangeRate ? this.formatNumber(pmt.exchangeRate) : '-';
            
            return `
                <tr class="${isSelected ? 'selected' : ''}" data-id="${pmt.paymentId}">
                    <td class="col-check">
                        <input type="radio" name="payment-select" class="payment-radio" data-id="${pmt.paymentId}" ${isSelected ? 'checked' : ''}>
                    </td>
                    <td class="col-ref">${pmt.reference || pmt.paymentName || '-'}</td>
                    <td class="col-cpty">${pmt.counterpartyName || '-'}</td>
                    <td class="col-amount">${this.formatNumber(pmt.amount)}</td>
                    <td class="col-balance ${unallocClass}">${this.formatNumber(unallocated)}</td>
                    <td class="col-curr">${pmt.currency || '-'}</td>
                    <td class="col-rate">${exchRate}</td>
                    <td class="col-date">${this.formatDate(pmt.valueDate)}</td>
                    <td class="col-account">${pmt.bankAccountName || pmt.bankAccountNumber || '-'}</td>
                    <td class="col-strategy">${pmt.strategyName || '-'}</td>
                    <td class="col-dir ${dirClass}">${direction}</td>
                </tr>
            `;
        }).join('');

        // Bind radio button events
        tbody.querySelectorAll('.payment-radio').forEach(rb => {
            rb.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                // Clear previous selection styling
                tbody.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
                // Set new selection
                this.selectedPayment = id;
                e.target.closest('tr').classList.add('selected');
                this.updateSummary();
            });
        });

        this.updateSummary();
    }

    renderAllocations() {
        const tbody = document.getElementById('allocationsBody');
        
        // Ensure array exists
        if (!Array.isArray(this.allocations)) this.allocations = [];
        
        if (this.allocations.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="8">No allocations</td></tr>';
            return;
        }

        // Sort by date descending (newest first) and show last 20
        const sorted = [...this.allocations].sort((a, b) => {
            const dateA = new Date(a.createdDate || a.createDate || a.entryDate || a.paymentValueDate || 0);
            const dateB = new Date(b.createdDate || b.createDate || b.entryDate || b.paymentValueDate || 0);
            return dateB - dateA; // Descending (newest first)
        });
        const recent = sorted.slice(0, 20);
        
        tbody.innerHTML = recent.map(alloc => {
            // Try multiple field names for invoice
            const invoiceRef = alloc.invoiceNumber || alloc.invoiceName || alloc.targetName || 
                               alloc.invoiceReference || (alloc.invoiceId ? alloc.invoiceId.substring(0, 10) : '-');
            
            // Try multiple field names for payment
            const paymentRef = alloc.paymentReference || alloc.paymentName || alloc.sourceName ||
                               (alloc.paymentId ? alloc.paymentId.substring(0, 10) : '-');
            
            // Get date from various possible fields
            const allocDate = alloc.createdDate || alloc.createDate || alloc.entryDate || alloc.paymentValueDate || alloc.date;
            
            // Get counterparty from various possible fields
            const counterparty = alloc.counterpartyName || alloc.counterparty || alloc.companyName || '-';
            
            return `
                <tr>
                    <td>${alloc.allocationName || alloc.name || (alloc.allocationId ? alloc.allocationId.substring(0, 8) : '-')}</td>
                    <td>${invoiceRef}</td>
                    <td>${paymentRef}</td>
                    <td>${counterparty}</td>
                    <td>${this.formatNumber(alloc.amount)}</td>
                    <td>${alloc.currency || '-'}</td>
                    <td>${this.formatDate(allocDate)}</td>
                    <td>${alloc.state || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-danger delete-alloc" data-id="${alloc.allocationId || alloc.id}">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Bind delete events
        tbody.querySelectorAll('.delete-alloc').forEach(btn => {
            btn.addEventListener('click', () => this.deleteAllocation(btn.dataset.id));
        });
    }

    updateSummary() {
        // Ensure arrays exist
        if (!Array.isArray(this.invoices)) this.invoices = [];
        if (!Array.isArray(this.payments)) this.payments = [];

        // Invoice summary
        let invoiceCount = this.selectedInvoice ? 1 : 0;
        let invoiceAmount = 0;
        const selectedInv = this.invoices.find(inv => inv && inv.invoiceId === this.selectedInvoice);
        if (selectedInv) {
            invoiceAmount = Math.abs(selectedInv.invoiceBalance || 0);
        }
        document.getElementById('selectedInvoicesCount').textContent = invoiceCount;
        document.getElementById('selectedInvoicesAmount').textContent = this.formatNumber(invoiceAmount);

        // Payment summary
        let paymentCount = this.selectedPayment ? 1 : 0;
        let paymentAmount = 0;
        const selectedPmt = this.payments.find(pmt => pmt && pmt.paymentId === this.selectedPayment);
        if (selectedPmt) {
            paymentAmount = Math.abs(selectedPmt.unallocatedAmount !== undefined ? selectedPmt.unallocatedAmount : (selectedPmt.amount || 0));
        }
        document.getElementById('selectedPaymentsCount').textContent = paymentCount;
        document.getElementById('selectedPaymentsAmount').textContent = this.formatNumber(paymentAmount);

        // Enable/disable create button
        const canCreate = invoiceCount > 0 && paymentCount > 0;
        document.getElementById('createAllocationBtn').disabled = !canCreate;
    }

    async createAllocation() {
        if (!this.selectedInvoice || !this.selectedPayment) {
            this.showMessage('Select one invoice and one payment', 'error');
            return;
        }

        const customAmount = parseFloat(document.getElementById('allocationAmount').value);
        const btn = document.getElementById('createAllocationBtn');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            // Ensure arrays exist
            if (!Array.isArray(this.invoices)) this.invoices = [];
            if (!Array.isArray(this.payments)) this.payments = [];
            
            const invoice = this.invoices.find(i => i && i.invoiceId === this.selectedInvoice);
            const payment = this.payments.find(p => p && p.paymentId === this.selectedPayment);
            
            // Determine amount
            let amount = customAmount;
            if (!amount || isNaN(amount)) {
                // Use the smaller of invoice balance or payment unallocated
                const invBalance = Math.abs(invoice?.invoiceBalance || 0);
                const pmtUnalloc = Math.abs(payment?.unallocatedAmount || payment?.amount || 0);
                amount = Math.min(invBalance, pmtUnalloc);
            }

            if (amount <= 0) {
                this.showMessage('Cannot allocate zero amount', 'error');
                btn.disabled = false;
                btn.textContent = 'Create Allocation';
                return;
            }

            const response = await fetch('/api/allocations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    invoiceId: this.selectedInvoice, 
                    paymentId: this.selectedPayment, 
                    amount 
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showMessage('Allocation created successfully', 'success');
                
                // Clear selections and reload
                this.selectedInvoice = null;
                this.selectedPayment = null;
                document.getElementById('allocationAmount').value = '';
                await this.loadData();
            } else {
                this.showMessage('Failed to create allocation: ' + (data.error || 'Unknown error'), 'error');
            }
            
        } catch (error) {
            console.error('Error creating allocation:', error);
            this.showMessage('Error: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Allocation';
        }
    }

    async deleteAllocation(id) {
        if (!confirm('Delete this allocation?')) return;

        try {
            const response = await fetch(`/api/allocations/${id}`, { method: 'DELETE' });
            
            if (response.ok) {
                this.showMessage('Allocation deleted', 'success');
                await this.loadData();
            } else {
                const data = await response.json();
                this.showMessage('Failed to delete: ' + (data.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            this.showMessage('Error: ' + error.message, 'error');
        }
    }

    showMessage(text, type) {
        const msgDiv = document.getElementById('actionMessage');
        msgDiv.textContent = text;
        msgDiv.className = `action-message ${type}`;
        msgDiv.classList.remove('hidden');
        
        setTimeout(() => {
            msgDiv.classList.add('hidden');
        }, 5000);
    }

    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) return '-';
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    }

    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SettlementApp();
});
