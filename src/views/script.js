// Configuração da API
const API_BASE = 'http://localhost:3001/api/v1';
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFuZHJlQGVtYWlsLmNvbSIsInN1YiI6IjY4YjhkNjk0YmRiNzM0NmFlYzVmMjJhOSIsImlhdCI6MTc1Njk0NDAzMiwiZXhwIjoxNzU2OTQ0OTMyfQ.13ubd4H2SxSKVCDFnqm2CoUzjQFYeaUHbcPBOI-g76Y';

// Estado global
let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();
let currentPage = 1;
let editingCell = null;

// Categorias
const categories = {
    income: {
        salary: 'Salário',
        freelance: 'Freelance',
        sales: 'Vendas',
        investments: 'Investimentos',
        other: 'Outros'
    },
    expense: {
        food: 'Alimentação',
        transport: 'Transporte',
        bills: 'Contas',
        leisure: 'Lazer',
        health: 'Saúde',
        education: 'Educação',
        shopping: 'Compras',
        other: 'Outros'
    }
};

// Utilitários
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return 'R$ 0,00';
    }
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Ajustar timezone
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    return date.toLocaleDateString('pt-BR');
}

function formatDateInput(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

function getMonthName(month, year) {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-BR', { 
        month: 'long', 
        year: 'numeric' 
    });
}

function showLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.remove('hidden');
    }
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
    }
}

function showToast(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 5000);
}

// API calls
async function apiCall(endpoint, options = {}) {
    showLoading();
    
    try {
        console.log(`API Call: ${API_BASE}${endpoint}`);
        
        const config = {
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };
        
        if (options.body) {
            config.body = options.body;
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, config);
        
        console.log(`Response status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        return data;
        
    } catch (error) {
        console.error('API Call Error:', error);
        showToast('error', 'Erro na API', error.message);
        throw error;
    } finally {
        hideLoading();
    }
}

// Event handlers
function setupEventHandlers() {
    // Formulário de transação
    const form = document.getElementById('transaction-form');
    if (form) {
        form.addEventListener('submit', handleSubmitTransaction);
    }
    
    // Tipo de transação - atualizar categorias
    const typeSelect = document.getElementById('type');
    if (typeSelect) {
        typeSelect.addEventListener('change', updateCategories);
    }
    
    // Navegação de meses
    const btnPrev = document.getElementById('btn-prev-month');
    const btnNext = document.getElementById('btn-next-month');
    if (btnPrev) btnPrev.addEventListener('click', () => navigateMonth(-1));
    if (btnNext) btnNext.addEventListener('click', () => navigateMonth(1));
    
    // Refresh
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) btnRefresh.addEventListener('click', loadData);
    
    // Filtros
    const btnFilter = document.getElementById('btn-filter');
    if (btnFilter) btnFilter.addEventListener('click', loadTransactions);
    
    const filterSearch = document.getElementById('filter-search');
    if (filterSearch) {
        filterSearch.addEventListener('input', debounce(loadTransactions, 500));
    }
    
    console.log('Event handlers configurados');
}

function updateCategories() {
    const typeSelect = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    
    if (!typeSelect || !categorySelect) return;
    
    const type = typeSelect.value;
    const categoryOptions = categories[type] || {};
    
    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    Object.entries(categoryOptions).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        categorySelect.appendChild(option);
    });
}

function navigateMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    updateMonthDisplay();
    loadData();
}

function updateMonthDisplay() {
    const monthSpan = document.getElementById('current-month');
    if (monthSpan) {
        monthSpan.textContent = getMonthName(currentMonth, currentYear);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Carregar dados
async function loadData() {
    console.log('Carregando dados...');
    try {
        await Promise.all([
            loadTransactions(),
            loadSpreadsheet()
        ]);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

async function loadTransactions() {
    try {
        const params = new URLSearchParams({
            page: currentPage.toString(),
            limit: '10'
        });
        
        const filterType = document.getElementById('filter-type');
        const filterSearch = document.getElementById('filter-search');
        
        if (filterType && filterType.value) {
            params.append('type', filterType.value);
        }
        
        if (filterSearch && filterSearch.value.trim()) {
            params.append('search', filterSearch.value.trim());
        }
        
        const response = await apiCall(`/transactions?${params.toString()}`);
        
        if (response.success) {
            renderTransactions(response.data || []);
            renderPagination(response.pagination);
        } else {
            throw new Error('Resposta da API indica falha');
        }
        
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        renderTransactions([]);
    }
}

async function loadSpreadsheet() {
    try {
        const response = await apiCall(`/spreadsheet/${currentYear}/${currentMonth}`);
        
        if (response.success && response.data) {
            renderSpreadsheet(response.data);
            updateSummary(response.data);
        } else {
            throw new Error('Planilha não encontrada');
        }
        
    } catch (error) {
        console.error('Erro ao carregar planilha:', error);
        // Se não encontrar, mostrar planilha vazia
        renderEmptySpreadsheet();
        updateSummary(null);
    }
}

// Renderização
function renderTransactions(transactions) {
    const tbody = document.getElementById('transactions-tbody');
    if (!tbody) return;
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-inbox"></i><br>
                    Nenhuma transação encontrada
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => `
        <tr>
            <td>${formatDate(transaction.date)}</td>
            <td>
                <span class="transaction-type ${transaction.type}">
                    ${transaction.type === 'income' ? 'Receita' : 'Despesa'}
                </span>
            </td>
            <td>${getCategoryLabel(transaction.type, transaction.category)}</td>
            <td>${transaction.description || '-'}</td>
            <td class="value ${transaction.type === 'income' ? 'positive' : 'negative'}">
                ${formatCurrency(transaction.amount)}
            </td>
            <td>
                <div class="actions">
                    <button class="btn btn-danger btn-small" onclick="deleteTransaction('${transaction._id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getCategoryLabel(type, category) {
    return categories[type]?.[category] || category || '-';
}

function renderPagination(pagination) {
    const container = document.getElementById('pagination');
    if (!container) return;
    
    if (!pagination || pagination.totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    const { page, totalPages } = pagination;
    
    let html = `
        <button onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    const maxPages = 5;
    let startPage = Math.max(1, page - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button onclick="goToPage(${i})" ${i === page ? 'class="active"' : ''}>${i}</button>
        `;
    }
    
    html += `
        <button onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    container.innerHTML = html;
}

function renderSpreadsheet(data) {
    if (!data || !data.dailyData) {
        renderEmptySpreadsheet();
        return;
    }
    
    const tbody = document.getElementById('spreadsheet-tbody');
    if (!tbody) return;
    
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    let html = '';
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayData = data.dailyData.find(d => d.day === day) || {
            day,
            income: 0,
            expenses: 0,
            dailySpending: 0,
            balance: 0,
            calculatedBalance: 0
        };
        
        html += `
            <tr>
                <td class="day-cell">${day}</td>
                <td class="editable-cell" onclick="editCell(${day}, 'income', ${dayData.income})">
                    ${formatCurrency(dayData.income)}
                </td>
                <td class="editable-cell" onclick="editCell(${day}, 'expenses', ${dayData.expenses})">
                    ${formatCurrency(dayData.expenses)}
                </td>
                <td class="editable-cell" onclick="editCell(${day}, 'dailySpending', ${dayData.dailySpending})">
                    ${formatCurrency(dayData.dailySpending)}
                </td>
                <td class="value ${dayData.balance >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(dayData.balance)}
                </td>
                <td class="value ${dayData.calculatedBalance >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(dayData.calculatedBalance)}
                </td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
}

function renderEmptySpreadsheet() {
    const tbody = document.getElementById('spreadsheet-tbody');
    if (!tbody) return;
    
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    let html = '';
    
    for (let day = 1; day <= daysInMonth; day++) {
        html += `
            <tr>
                <td class="day-cell">${day}</td>
                <td class="editable-cell" onclick="editCell(${day}, 'income', 0)">
                    ${formatCurrency(0)}
                </td>
                <td class="editable-cell" onclick="editCell(${day}, 'expenses', 0)">
                    ${formatCurrency(0)}
                </td>
                <td class="editable-cell" onclick="editCell(${day}, 'dailySpending', 0)">
                    ${formatCurrency(0)}
                </td>
                <td class="value">${formatCurrency(0)}</td>
                <td class="value">${formatCurrency(0)}</td>
            </tr>
        `;
    }
    
    tbody.innerHTML = html;
}

function updateSummary(data) {
    const totalIncome = document.getElementById('total-income');
    const totalExpenses = document.getElementById('total-expenses');
    const netBalance = document.getElementById('net-balance');
    
    if (!totalIncome || !totalExpenses || !netBalance) return;
    
    if (!data || !data.monthlyProjections) {
        totalIncome.textContent = formatCurrency(0);
        totalIncome.className = 'value';
        
        totalExpenses.textContent = formatCurrency(0);
        totalExpenses.className = 'value';
        
        netBalance.textContent = formatCurrency(0);
        netBalance.className = 'value';
        return;
    }
    
    const { totalIncome: income, totalExpenses: expenses, netBalance: balance } = data.monthlyProjections;
    
    totalIncome.textContent = formatCurrency(income || 0);
    totalIncome.className = 'value positive';
    
    totalExpenses.textContent = formatCurrency(expenses || 0);
    totalExpenses.className = 'value negative';
    
    netBalance.textContent = formatCurrency(balance || 0);
    netBalance.className = `value ${(balance || 0) >= 0 ? 'positive' : 'negative'}`;
}

// Ações
// Ações
async function handleSubmitTransaction(e) {
    e.preventDefault();
    
    const typeSelect = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    const amountInput = document.getElementById('amount');
    const dateInput = document.getElementById('date');
    const descriptionInput = document.getElementById('description');
    const isRecurringInput = document.getElementById('isRecurring');
    
    if (!typeSelect || !categorySelect || !amountInput || !dateInput) {
        showToast('error', 'Erro', 'Campos obrigatórios não encontrados');
        return;
    }
    
    if (!typeSelect.value || !categorySelect.value || !amountInput.value || !dateInput.value) {
        showToast('error', 'Erro', 'Preencha todos os campos obrigatórios');
        return;
    }
    
    const formData = {
        type: typeSelect.value,
        category: categorySelect.value,
        amount: parseFloat(amountInput.value),
        date: dateInput.value,
        description: descriptionInput ? descriptionInput.value.trim() : ''
    };

    // Recorrência mensal no mesmo dia da data selecionada
    if (isRecurringInput && isRecurringInput.checked) {
        const dateObj = new Date(dateInput.value);
        // Usa UTC para evitar problemas de fuso
        const dayOfMonth = dateObj.getUTCDate();
        formData.isRecurring = true;
        formData.recurringPattern = {
            frequency: 'monthly',
            dayOfMonth,
            isActive: true
        };
    }
    
    if (formData.amount <= 0) {
        showToast('error', 'Erro', 'O valor deve ser maior que zero');
        return;
    }
    
    try {
        const response = await apiCall('/transactions', {
            method: 'POST',
            body: JSON.stringify(formData)
        });
        
        if (response.success) {
            showToast('success', 'Sucesso', 'Transação criada com sucesso!');
            
            // Limpar formulário
            const form = document.getElementById('transaction-form');
            if (form) {
                form.reset();
                // Resetar data para hoje
                if (dateInput) {
                    dateInput.value = new Date().toISOString().split('T')[0];
                }
                // Limpar categorias
                if (categorySelect) {
                    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
                }
            }
            
            // Recarregar dados
            loadData();
        }
        
    } catch (error) {
        console.error('Erro ao criar transação:', error);
        showToast('error', 'Erro', 'Erro ao criar transação');
    }
}

async function deleteTransaction(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) {
        return;
    }
    
    try {
        const response = await apiCall(`/transactions/${id}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            showToast('success', 'Sucesso', 'Transação excluída com sucesso!');
            loadData();
        }
        
    } catch (error) {
        console.error('Erro ao excluir transação:', error);
        showToast('error', 'Erro', 'Erro ao excluir transação');
    }
}

function goToPage(page) {
    if (page < 1) return;
    currentPage = page;
    loadTransactions();
}

// Edição de células da planilha
function editCell(day, field, currentValue) {
    // Cancelar edição anterior
    if (editingCell) {
        cancelEdit();
    }
    
    const cell = event.target;
    editingCell = { day, field, cell, originalValue: currentValue };
    
    // Criar input
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.01';
    input.min = '0';
    input.value = currentValue || 0;
    input.className = 'cell-input';
    
    // Substituir conteúdo
    cell.innerHTML = '';
    cell.appendChild(input);
    cell.classList.add('editing');
    
    // Focar e selecionar
    input.focus();
    input.select();
    
    // Eventos
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

async function saveEdit() {
    if (!editingCell) return;
    
    const { day, field, cell } = editingCell;
    const input = cell.querySelector('.cell-input');
    
    if (!input) return;
    
    const newValue = parseFloat(input.value) || 0;
    
    if (newValue < 0) {
        showToast('error', 'Erro', 'Valor não pode ser negativo');
        cancelEdit();
        return;
    }
    
    try {
        const updateData = {};
        updateData[field] = newValue;
        
        const response = await apiCall(`/spreadsheet/${currentYear}/${currentMonth}/day/${day}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        if (response.success) {
            showToast('success', 'Sucesso', 'Planilha atualizada com sucesso!');
            loadSpreadsheet(); // Recarregar apenas a planilha
        }
        
    } catch (error) {
        console.error('Erro ao atualizar planilha:', error);
        showToast('error', 'Erro', 'Erro ao atualizar planilha');
        cancelEdit();
    }
    
    editingCell = null;
}

function cancelEdit() {
    if (!editingCell) return;
    
    const { cell, originalValue } = editingCell;
    cell.innerHTML = formatCurrency(originalValue || 0);
    cell.classList.remove('editing');
    editingCell = null;
}

// Inicialização
function init() {
    console.log('Inicializando aplicação...');
    
    // Configurar data atual
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Configurar event handlers
    setupEventHandlers();
    
    // Atualizar display do mês
    updateMonthDisplay();
    
    // Carregar dados iniciais
    loadData();
    
    console.log('Aplicação inicializada');
}

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);