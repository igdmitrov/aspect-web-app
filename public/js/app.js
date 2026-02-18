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
        this.aspectPortalUrl = '';
        this.editDataEnabled = true;
        
        // Sort state for each table
        this.sortState = {
            invoices: { column: 'dueDate', direction: 'asc' },
            payments: { column: 'valueDate', direction: 'asc' },
            allocations: { column: 'date', direction: 'desc' }
        };
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        await this.loadCurrentUser();
        this.initChoices();
        this.bindEvents();
        await this.loadData();
    }

    async loadConfig() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                this.aspectPortalUrl = config.aspectPortalUrl || '';
                this.editDataEnabled = config.editDataEnabled !== false;
                this.updateEditDataUI();
                this.updateBaseUrlLabel();
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    }

    updateBaseUrlLabel() {
        const baseUrlLabel = document.getElementById('baseUrlLabel');
        if (baseUrlLabel && this.aspectPortalUrl) {
            baseUrlLabel.textContent = this.aspectPortalUrl;
        }
    }

    updateEditDataUI() {
        // Hide/show edit elements based on editDataEnabled setting
        const createBtn = document.getElementById('createAllocationBtn');
        const amountInput = document.getElementById('allocationAmount');
        
        if (!this.editDataEnabled) {
            if (createBtn) {
                createBtn.style.display = 'none';
            }
            if (amountInput) {
                amountInput.style.display = 'none';
            }
        }
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
        document.getElementById('issueDateFrom').addEventListener('change', () => this.applyFilters());
        document.getElementById('issueDateTo').addEventListener('change', () => this.applyFilters());
        document.getElementById('dueDateFrom').addEventListener('change', () => this.applyFilters());
        document.getElementById('dueDateTo').addEventListener('change', () => this.applyFilters());
        
        // Create Allocation
        document.getElementById('createAllocationBtn').addEventListener('click', () => this.createAllocation());
        
        // Toggle allocations
        document.getElementById('toggleAllocations').addEventListener('click', () => {
            const wrapper = document.getElementById('allocationsWrapper');
            wrapper.classList.toggle('collapsed');
        });
        
        // Sortable headers
        this.bindSortEvents();
    }
    
    bindSortEvents() {
        // Invoices table sorting
        document.querySelectorAll('#invoicesTable th.sortable').forEach(th => {
            th.addEventListener('click', () => this.handleSort('invoices', th.dataset.sort, th));
        });
        
        // Payments table sorting
        document.querySelectorAll('#paymentsTable th.sortable').forEach(th => {
            th.addEventListener('click', () => this.handleSort('payments', th.dataset.sort, th));
        });
        
        // Allocations table sorting
        document.querySelectorAll('#allocationsTable th.sortable').forEach(th => {
            th.addEventListener('click', () => this.handleSort('allocations', th.dataset.sort, th));
        });
        
        // Apply initial sort indicators
        this.updateSortIndicators();
    }
    
    handleSort(table, column, th) {
        const state = this.sortState[table];
        
        // Toggle direction if same column, otherwise set ascending
        if (state.column === column) {
            state.direction = state.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.column = column;
            state.direction = 'asc';
        }
        
        this.updateSortIndicators();
        
        // Re-render the appropriate table
        if (table === 'invoices') {
            this.applyFilters();
        } else if (table === 'payments') {
            this.applyFilters();
        } else if (table === 'allocations') {
            this.renderAllocations();
        }
    }
    
    updateSortIndicators() {
        // Update invoices table
        document.querySelectorAll('#invoicesTable th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === this.sortState.invoices.column) {
                th.classList.add(`sort-${this.sortState.invoices.direction}`);
            }
        });
        
        // Update payments table
        document.querySelectorAll('#paymentsTable th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === this.sortState.payments.column) {
                th.classList.add(`sort-${this.sortState.payments.direction}`);
            }
        });
        
        // Update allocations table
        document.querySelectorAll('#allocationsTable th.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === this.sortState.allocations.column) {
                th.classList.add(`sort-${this.sortState.allocations.direction}`);
            }
        });
    }
    
    sortData(data, column, direction) {
        const dateColumns = ['dueDate', 'issueDate', 'valueDate', 'date', 'createdDate', 'createDate', 'entryDate', 'paymentValueDate'];
        const numericColumns = ['amount', 'invoiceBalance', 'unallocatedAmount', 'exchangeRate'];
        const boolColumns = ['isIncoming'];
        
        return [...data].sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            
            // Handle nested or fallback values for allocations
            if (column === 'date') {
                valA = a.createdDate || a.createDate || a.entryDate || a.paymentValueDate || a.date;
                valB = b.createdDate || b.createDate || b.entryDate || b.paymentValueDate || b.date;
            }
            if (column === 'invoiceName' && !valA) {
                valA = a.isIncoming ? a.sourceName : a.targetName;
            }
            if (column === 'invoiceName' && !valB) {
                valB = b.isIncoming ? b.sourceName : b.targetName;
            }
            if (column === 'paymentName' && !valA) {
                valA = a.isIncoming ? a.targetName : a.sourceName;
            }
            if (column === 'paymentName' && !valB) {
                valB = b.isIncoming ? b.targetName : b.sourceName;
            }
            if (column === 'allocationName' && !valA) {
                valA = a.name || a.allocationId;
            }
            if (column === 'allocationName' && !valB) {
                valB = b.name || b.allocationId;
            }
            
            // Handle null/undefined
            if (valA == null && valB == null) return 0;
            if (valA == null) return direction === 'asc' ? 1 : -1;
            if (valB == null) return direction === 'asc' ? -1 : 1;
            
            let comparison = 0;
            
            if (dateColumns.includes(column)) {
                const dateA = new Date(valA);
                const dateB = new Date(valB);
                comparison = dateA - dateB;
            } else if (numericColumns.includes(column)) {
                comparison = (parseFloat(valA) || 0) - (parseFloat(valB) || 0);
            } else if (boolColumns.includes(column)) {
                comparison = (valA ? 1 : 0) - (valB ? 1 : 0);
            } else {
                // String comparison
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();
                comparison = strA.localeCompare(strB);
            }
            
            return direction === 'asc' ? comparison : -comparison;
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
        const t0 = performance.now();
        
        try {
            const tFetch = performance.now();
            const [invoicesRes, paymentsRes, allocationsRes] = await Promise.all([
                fetch('/api/invoices/open'),
                fetch('/api/payments/open'),
                fetch('/api/allocations')
            ]);
            console.log(`[timing] fetch all APIs: ${(performance.now() - tFetch).toFixed(0)}ms`);

            if (!invoicesRes.ok || !paymentsRes.ok) {
                if (invoicesRes.status === 401 || paymentsRes.status === 401) {
                    window.location.href = '/login';
                    return;
                }
                throw new Error('Failed to load data');
            }

            const tParse = performance.now();
            let invoicesData = await invoicesRes.json();
            let paymentsData = await paymentsRes.json();
            let allocationsData = allocationsRes.ok ? await allocationsRes.json() : [];
            console.log(`[timing] parse JSON: ${(performance.now() - tParse).toFixed(0)}ms`);

            // Ensure data is always an array
            this.invoices = Array.isArray(invoicesData) ? invoicesData : (invoicesData ? [invoicesData] : []);
            this.payments = Array.isArray(paymentsData) ? paymentsData : (paymentsData ? [paymentsData] : []);
            this.allocations = Array.isArray(allocationsData) ? allocationsData : (allocationsData ? [allocationsData] : []);

            console.log(`Loaded: ${this.invoices.length} invoices, ${this.payments.length} payments, ${this.allocations.length} allocations`);

            const tRender = performance.now();
            
            // Save current filter values before rebuilding dropdowns
            const savedCounterparty = document.getElementById('counterpartyFilter').value;
            const savedCurrency = document.getElementById('currencyFilter').value;
            const savedStatus = document.getElementById('statusFilter').value;
            const savedIssueDateFrom = document.getElementById('issueDateFrom').value;
            const savedIssueDateTo = document.getElementById('issueDateTo').value;
            const savedDueDateFrom = document.getElementById('dueDateFrom').value;
            const savedDueDateTo = document.getElementById('dueDateTo').value;

            this.extractFilters();

            // Restore saved filter values
            if (savedCurrency && Array.from(this.currencies).includes(savedCurrency)) {
                document.getElementById('currencyFilter').value = savedCurrency;
            }
            document.getElementById('statusFilter').value = savedStatus;
            document.getElementById('issueDateFrom').value = savedIssueDateFrom;
            document.getElementById('issueDateTo').value = savedIssueDateTo;
            document.getElementById('dueDateFrom').value = savedDueDateFrom;
            document.getElementById('dueDateTo').value = savedDueDateTo;
            if (savedCounterparty && this.counterparties.includes(savedCounterparty)) {
                this.counterpartyChoices.setChoiceByValue(savedCounterparty);
            }

            this.applyFilters();
            this.renderAllocations();
            console.log(`[timing] render: ${(performance.now() - tRender).toFixed(0)}ms`);
            console.log(`[timing] total loadData: ${(performance.now() - t0).toFixed(0)}ms`);
            
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
        const issueDateFrom = document.getElementById('issueDateFrom').value;
        const issueDateTo = document.getElementById('issueDateTo').value;
        const dueDateFrom = document.getElementById('dueDateFrom').value;
        const dueDateTo = document.getElementById('dueDateTo').value;

        console.log('Applying filters:', { counterparty, currency, status, issueDateFrom, issueDateTo, dueDateFrom, dueDateTo });
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
            
            // Issue Date filter
            if (issueDateFrom && inv.issueDate) {
                const issueDate = inv.issueDate.split('T')[0];
                if (issueDate < issueDateFrom) return false;
            }
            if (issueDateTo && inv.issueDate) {
                const issueDate = inv.issueDate.split('T')[0];
                if (issueDate > issueDateTo) return false;
            }
            
            // Due Date filter
            if (dueDateFrom && inv.dueDate) {
                const dueDate = inv.dueDate.split('T')[0];
                if (dueDate < dueDateFrom) return false;
            }
            if (dueDateTo && inv.dueDate) {
                const dueDate = inv.dueDate.split('T')[0];
                if (dueDate > dueDateTo) return false;
            }
            
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
        const tStart = performance.now();
        const tbody = document.getElementById('invoicesBody');
        document.getElementById('invoiceCount').textContent = invoices.length;
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="14">No invoices found</td></tr>';
            return;
        }

        // Apply sorting
        const { column, direction } = this.sortState.invoices;
        const sortedInvoices = this.sortData(invoices, column, direction);

        tbody.innerHTML = sortedInvoices.map(inv => {
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
                    <td class="col-id">${this.createAspectLink(inv.invoiceId, inv.invoiceName)}</td>
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

        // Use event delegation instead of individual listeners
        tbody.onclick = (e) => {
            const rb = e.target.closest('.invoice-radio');
            if (!rb) return;
            const id = rb.dataset.id;
            tbody.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
            this.selectedInvoice = id;
            rb.closest('tr').classList.add('selected');
            this.updateSummary();
        };

        this.updateSummary();
        console.log(`[timing] renderInvoices (${invoices.length} rows): ${(performance.now() - tStart).toFixed(0)}ms`);
    }

    renderPayments(payments) {
        const tStart = performance.now();
        const tbody = document.getElementById('paymentsBody');
        document.getElementById('paymentCount').textContent = payments.length;
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="10">No payments found</td></tr>';
            return;
        }

        // Apply sorting
        const { column, direction } = this.sortState.payments;
        const sortedPayments = this.sortData(payments, column, direction);

        tbody.innerHTML = sortedPayments.map(pmt => {
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
                    <td class="col-ref">${this.createAspectLink(pmt.paymentId, pmt.reference || pmt.paymentName)}</td>
                    <td class="col-cpty">${pmt.counterpartyName || '-'}</td>
                    <td class="col-amount">${this.formatNumber(pmt.amount)}</td>
                    <td class="col-balance ${unallocClass}">${this.formatNumber(unallocated)}</td>
                    <td class="col-curr">${pmt.currency || '-'}</td>
                    <td class="col-rate">${exchRate}</td>
                    <td class="col-date">${this.formatDate(pmt.valueDate)}</td>
                    <td class="col-account">${pmt.bankAccountName || pmt.bankAccountNumber || '-'}</td>
                    <td class="col-dir ${dirClass}">${direction}</td>
                </tr>
            `;
        }).join('');

        // Use event delegation instead of individual listeners
        tbody.onclick = (e) => {
            const rb = e.target.closest('.payment-radio');
            if (!rb) return;
            const id = rb.dataset.id;
            tbody.querySelectorAll('tr.selected').forEach(tr => tr.classList.remove('selected'));
            this.selectedPayment = id;
            rb.closest('tr').classList.add('selected');
            this.updateSummary();
        };

        this.updateSummary();
        console.log(`[timing] renderPayments (${payments.length} rows): ${(performance.now() - tStart).toFixed(0)}ms`);
    }

    renderAllocations() {
        const tbody = document.getElementById('allocationsBody');
        
        // Ensure array exists
        if (!Array.isArray(this.allocations)) this.allocations = [];
        
        if (this.allocations.length === 0) {
            tbody.innerHTML = '<tr class="loading-row"><td colspan="9">No allocations</td></tr>';
            return;
        }

        // Apply sorting using sortState
        const { column, direction } = this.sortState.allocations;
        const sorted = this.sortData(this.allocations, column, direction);
        const recent = sorted.slice(0, 200);
        
        tbody.innerHTML = recent.map(alloc => {
            // Try multiple field names for invoice
            // Direction-aware: for incoming invoices source=invoice/target=payment, for outgoing source=payment/target=invoice
            const invoiceFallbackName = alloc.isIncoming ? alloc.sourceName : alloc.targetName;
            const invoiceRef = alloc.invoiceNumber || alloc.invoiceName || alloc.invoiceReference || 
                               invoiceFallbackName || (alloc.invoiceId ? alloc.invoiceId.substring(0, 10) : '-');
            
            // Try multiple field names for payment
            const paymentFallbackName = alloc.isIncoming ? alloc.targetName : alloc.sourceName;
            const paymentRef = alloc.paymentReference || alloc.paymentName || 
                               paymentFallbackName || (alloc.paymentId ? alloc.paymentId.substring(0, 10) : '-');
            
            // Get date from various possible fields
            const allocDate = alloc.createdDate || alloc.createDate || alloc.entryDate || alloc.paymentValueDate || alloc.date;
            
            // Get counterparty from various possible fields
            const counterparty = alloc.counterpartyName || alloc.counterparty || alloc.companyName || '-';
            
            return `
                <tr>
                    <td>${alloc.allocationName || alloc.name || (alloc.allocationId ? alloc.allocationId.substring(0, 8) : '-')}</td>
                    <td>${this.createAspectLink(alloc.invoiceId, invoiceRef)}</td>
                    <td>${this.createAspectLink(alloc.paymentId, paymentRef)}</td>
                    <td>${counterparty}</td>
                    <td>${this.formatNumber(alloc.amount)}</td>
                    <td>${alloc.currency || '-'}</td>
                    <td>${this.formatDate(allocDate)}</td>
                    <td>${alloc.state || '-'}</td>
                    <td>
                        ${this.editDataEnabled ? `<button class="btn btn-sm btn-danger delete-alloc" data-id="${alloc.allocationId || alloc.id}">Delete</button>` : ''}
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
        // Check sign consistency: negative balance invoice requires negative payment (same sign)
        let signMismatch = false;
        if (selectedInv && selectedPmt) {
            const invBalance = selectedInv.invoiceBalance || 0;
            const pmtAmount = selectedPmt.amount || 0;
            signMismatch = (invBalance < 0) !== (pmtAmount < 0);
        }
        const canCreate = invoiceCount > 0 && paymentCount > 0 && !signMismatch;
        document.getElementById('createAllocationBtn').disabled = !canCreate;
        
        // Show warning if sign mismatch
        if (signMismatch) {
            this.showMessage('Sign mismatch: Invoice with negative balance requires payment with negative amount', 'error');
        }
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
            
            // Validate sign consistency
            const invBalance = invoice?.invoiceBalance || 0;
            const pmtAmount = payment?.amount || 0;
            if ((invBalance < 0) !== (pmtAmount < 0)) {
                this.showMessage('Sign mismatch: Invoice with negative balance requires payment with negative amount', 'error');
                btn.disabled = false;
                btn.textContent = 'Create Allocation';
                return;
            }
            
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

            if (response.ok && !data.error) {
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
            const response = await fetch(`/api/allocations/${encodeURIComponent(id)}`, { method: 'DELETE' });
            
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

    createAspectLink(entityId, displayText) {
        if (!displayText) return '-';
        if (!this.aspectPortalUrl || !entityId) return displayText;
        const url = `${this.aspectPortalUrl}/portal/aspect?action=edit&source=aspect&aspect-action=edit&aspect-edit-id=${entityId}`;
        return `<a href="${url}" target="_blank" class="aspect-link">${displayText}</a>`;
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SettlementApp();
});
