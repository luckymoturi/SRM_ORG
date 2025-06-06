const supplierOptions = {
  Agri: ["AAK India Pvt. Ltd.", "Cargill India Pvt Ltd", "Roquette", "Sukhjit Agro", "Nanglamal Sugar", "EID Parry", "Sethness Roquette"],
  Nutri: ["Givaudan India Pvt Ltd", "DSM Nutritionals", "Canton Labs", "Sujata Nutri Pharma", "IFF (Solae & Danisco)", "TATA Chemicals"],
  Dairy: ["Schreiber", "Parag Milk Foods Pvt Ltd", "Govind", "Modern Dairies"],
  Packaging: ["Huhtamaki PPL", "TCPL Packaging", "Parkson Pkg (Carton)", "Vishal Plastic", "Amcor Packaging", "Makers", "Shah Packwell", "MK Printpack", "GB Pack", "Parkson Packaging", "Parkson Pkg (Shipper)"]
};

const questions = [
  { label: "Portfolio diversity", name: "portfolio_diversity", options: [
    { score: 1, label: "Covers Partial SKU wrt Category" },
    { score: 3, label: "Covers All RM/PM SKU wrt Category" }
  ]},
  { label: "Credit Term offered", name: "credit_term", options: [
    { score: 1, label: "< 45 days" },
    { score: 2, label: "≥ 45 < 120" },
    { score: 3, label: "≥ 120 or MSME 45 Days" }
  ]},
  { label: "Capacity Outlook", name: "capacity_utilisation", options: [
    { score: 1.5, label: "Frequent Issues / Rigid Allocation" },
    { score: 3.0, label: "Flexible Capacity" },
    { score: 4.5, label: "Meets future capacity (2+ yrs)" }
  ]},
  { label: "Strategic Partnership Score", name: "strategic_partnership", options: [
    { score: 1.5, label: "< 30% SOB for 2 yrs" },
    { score: 3.0, label: "30–50% SOB" },
    { score: 4.5, label: "> 50% SOB for 2 yrs" }
  ]},
  { label: "Business Etiquette & Response Time", name: "business_etiquette", options: [
    { score: 1, label: "Below Average" },
    { score: 2, label: "Average" },
    { score: 3, label: "Satisfactory" },
    { score: 4, label: "Good" },
    { score: 5, label: "Excellent" }
  ]},
  { label: "Inventory carrying", name: "inventory_carrying", options: [
    { score: 0, label: "No" },
    { score: 2.5, label: "Right inventory not carried" },
    { score: 4.5, label: "Yes" }
  ]},
  { label: "Advance shipment notice", name: "advance_notice", options: [
    { score: 0, label: "No" },
    { score: 3, label: "Yes" }
  ]},
  { label: "Knowledge Sharing / Cont. Improvement Ideas", name: "knowledge_sharing", options: [
    { score: 0, label: "No" },
    { score: 3, label: "Yes" }
  ]},
  { label: "Legal contracts", name: "legal_contracts", options: [
    { score: 0, label: "No" },
    { score: 4.5, label: "Yes" }
  ]},
  { label: "Cost Competitiveness", name: "cost_competitiveness", options: [
    { score: 0, label: "Not competitive" },
    { score: 5, label: "Improvement needed" },
    { score: 10, label: "At par with market" }
  ]},
  { label: "Cost Model", name: "cost_model", options: [
    { score: 0, label: "No cost model" },
    { score: 5, label: "Improvement possible" },
    { score: 10, label: "Effective model" }
  ]},
  { label: "SDP Rating", name: "sdp_rating", options: [
    { score: 5, label: "< 75%" },
    { score: 10, label: "75–85%" },
    { score: 15, label: "85–95%" },
    { score: 20, label: ">= 95%" }
  ]},
  { label: "Quality Performance Rating (GLO)", name: "quality_glo", options: [
    { score: 0, label: "< 50%" },
    { score: 3, label: "50% ≥ x < 90%" },
    { score: 5, label: "90% ≥ x ≤ 100%" }
  ]},
  { label: "Quality Performance Rating (GSQA - ING)", name: "quality_gsqa_ing", options: [
    { score: 0, label: "< 50%" },
    { score: 6, label: "50% ≥ x < 75%" },
    { score: 12, label: "75% ≥ x < 90%" },
    { score: 18, label: "90% ≥ x < 100%" }
  ]},
  { label: "Supply Chain Notification", name: "sc_notification", options: [
    { score: 0, label: "Not shared" },
    { score: 2, label: "Yes, Shared" }
  ]},
  { label: "Supplier Surveillance Audit", name: "supplier_audit", options: [
    { score: 0, label: "Repeat observations, no CAPA implemented" },
    { score: 3, label: "CAPA in-progress, minor observations" },
    { score: 5, label: "All CAPA completed, no major repeat observation" }
  ]}
];
// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  const subCategorySelect = document.getElementById("subCategory");
  const supplierSelect = document.getElementById("supplierName");
  const questionsContainer = document.getElementById("evaluation-questions");
  const form = document.getElementById("supplierForm");
  const resultsSection = document.getElementById("results");
  const evaluationsTable = document.getElementById("evaluationsTable").querySelector("tbody");

  // Render all evaluation questions
  function renderQuestions() {
    questionsContainer.innerHTML = questions.map(q => `
      <div class="form-group">
        <label for="${q.name}">${q.label}</label>
        <select id="${q.name}" name="${q.name}" required>
          <option value="">Select Score</option>
          ${q.options.map(opt => `
            <option value="${opt.score}">${opt.score} - ${opt.label}</option>
          `).join("")}
        </select>
      </div>
    `).join("");
  }

  // Update supplier dropdown based on sub-category selection
  function updateSupplierOptions() {
    const subCat = subCategorySelect.value;
    supplierSelect.innerHTML = '<option value="">Select Supplier Name</option>';
    
    if (supplierOptions[subCat]) {
      supplierOptions[subCat].forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        supplierSelect.appendChild(option);
      });
    }
  }

  // Handle form submission
  async function handleFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    try {
      const response = await fetch('/api/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Evaluation submitted successfully!');
        form.reset();
        supplierSelect.innerHTML = '<option value="">Select Supplier Name</option>';
        loadRecentEvaluations();
      } else {
        alert(result.message || 'Submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('An error occurred. Please try again.');
    }
  }

  // Load recent evaluations from server
  async function loadRecentEvaluations() {
    try {
      const response = await fetch('/api/evaluations');
      const result = await response.json();
      
      if (result.success && result.data.length > 0) {
        evaluationsTable.innerHTML = result.data.map(eval => `
          <tr>
            <td>${eval.supplier_name}</td>
            <td>${eval.month.substring(0, 7)}</td>
            <td>${eval.total_score.toFixed(1)}</td>
            <td>${new Date(eval.created_at).toLocaleDateString()}</td>
          </tr>
        `).join("");
        resultsSection.classList.remove("hidden");
      }
    } catch (err) {
      console.error('Error loading evaluations:', err);
    }
  }

  // Set up event listeners
  subCategorySelect.addEventListener("change", updateSupplierOptions);
  form.addEventListener("submit", handleFormSubmit);

  // Initialize the UI
  renderQuestions();
  loadRecentEvaluations();
});