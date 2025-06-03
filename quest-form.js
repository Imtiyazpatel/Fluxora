// Quest Form functionality for posting new quests
class PostQuestForm {
  constructor(containerId, onPostCallback) {
    this.container = document.getElementById(containerId);
    this.onPost = onPostCallback;
    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <form id="quest-form" class="quest-form">
        <h2 class="quest-form-title">🪄 Post a New Quest</h2>
        <div class="form-group">
          <input
            type="text"
            id="quest-title"
            placeholder="Quest Title"
            class="form-input"
            required
          />
        </div>
        <div class="form-group">
          <textarea
            id="quest-description"
            placeholder="Quest Description (optional)"
            class="form-input"
            rows="3"
          ></textarea>
        </div>
        <div class="form-group">
          <input
            type="number"
            id="quest-reward"
            placeholder="Reward (ETH)"
            step="0.001"
            min="0"
            class="form-input"
            required
          />
        </div>
        <button type="submit" class="quest-submit-btn">
          Post Quest
        </button>
      </form>
    `;
  }

  bindEvents() {
    const form = document.getElementById('quest-form');
    const titleInput = document.getElementById('quest-title');
    const descriptionInput = document.getElementById('quest-description');
    const rewardInput = document.getElementById('quest-reward');

    if (!form || !titleInput || !rewardInput) {
      console.error('Quest form elements not found');
      return;
    }

    // Mobile-specific input handling
    if (window.isMobile) {
      // Prevent iOS zoom on focus
      titleInput.setAttribute('autocapitalize', 'words');
      titleInput.setAttribute('autocorrect', 'on');
      rewardInput.setAttribute('pattern', '[0-9]*\.?[0-9]*');
      rewardInput.setAttribute('inputmode', 'decimal');
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();

      try {
        const title = titleInput.value.trim();
        const description = descriptionInput.value.trim();
        const reward = rewardInput.value.trim();

        // Enhanced validation with crash protection
        if (!title || title.trim().length === 0) {
          this.showError('Please enter a quest title');
          return;
        }

        if (!reward || reward.trim().length === 0) {
          this.showError('Please enter a reward amount');
          return;
        }

        // Sanitize inputs
        const sanitizedTitle = title.trim().replace(/[<>]/g, '');
        const sanitizedDescription = description.trim().replace(/[<>]/g, '');

        const rewardNum = parseFloat(reward);
        if (isNaN(rewardNum) || !isFinite(rewardNum) || rewardNum <= 0) {
          this.showError('Please enter a valid reward amount');
          return;
        }

        if (rewardNum > 10) {
          this.showError('Reward amount cannot exceed 10 ETH');
          return;
        }

        if (rewardNum < 0.001) {
          this.showError('Minimum reward is 0.001 ETH');
          return;
        }

        if (sanitizedTitle.length > 100) {
          this.showError('Title must be less than 100 characters');
          return;
        }

        if (sanitizedDescription.length > 500) {
          this.showError('Description must be less than 500 characters');
          return;
        }

        this.onPost({ 
          title: sanitizedTitle, 
          description: sanitizedDescription, 
          reward: rewardNum 
        });

        // Clear form
        titleInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        rewardInput.value = '';

        // Show success feedback
        this.showSuccessMessage();

      } catch (error) {
        console.error('Error submitting quest:', error);
        this.showError('Failed to submit quest. Please try again.');
      }
    });
  }

  showSuccessMessage() {
    const button = document.querySelector('.quest-submit-btn');
    if (!button) return;

    const originalText = button.textContent;
    const originalBackground = button.style.background;

    button.textContent = '✅ Quest Posted!';
    button.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = originalBackground;
      button.disabled = false;
    }, 2000);
  }

  showError(message) {
    const button = document.querySelector('.quest-submit-btn');
    if (!button) return;

    const originalText = button.textContent;
    const originalBackground = button.style.background;

    button.textContent = `❌ ${message}`;
    button.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = originalBackground;
      button.disabled = false;
    }, 3000);
  }
}

// Example usage and quest management
class QuestManager {
  constructor() {
    this.quests = [];
  }

  // Initialize with default quests
  initializeDefaultQuests() {
    if (window.defaultQuests) {
      this.quests = [...window.defaultQuests];
      this.displayQuests();
    }
  }

  addQuest(questData) {
    try {
      if (!questData || !questData.title || questData.reward == null) {
        throw new Error('Invalid quest data provided');
      }

      const reward = typeof questData.reward === 'number' ? 
        questData.reward : parseFloat(questData.reward);

      if (isNaN(reward) || reward <= 0) {
        throw new Error('Invalid reward amount');
      }

      const quest = {
        id: Date.now() + Math.random(), // Ensure unique ID
        title: questData.title.substring(0, 100), // Limit title length
        description: (questData.description || '').substring(0, 500), // Limit description
        reward: reward,
        status: 'open',
        timestamp: new Date().toISOString(),
        creator: window.connectedAccount || 'anonymous'
      };

      this.quests.push(quest);
      console.log('New quest added:', quest);

      this.displayQuests();

      // Save to localStorage as backup
      try {
        localStorage.setItem('fluxora_quests', JSON.stringify(this.quests));
      } catch (storageError) {
        console.warn('Could not save quests to localStorage:', storageError);
      }

    } catch (error) {
      console.error('Error adding quest:', error);
      throw error;
    }
  }

  claimQuest(questId) {
    const quest = this.quests.find(q => q.id === questId);
    if (quest) {
      quest.status = 'claimed';
      console.log('Quest claimed:', quest);
      this.displayQuests();

      // Show success message
      this.showClaimSuccess(quest);
    }
  }

  showClaimSuccess(quest) {
    // Create temporary success message
    const successDiv = document.createElement('div');
    successDiv.innerHTML = `
      <div style="position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 1rem 1.5rem; border-radius: 12px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3); z-index: 1000; animation: slideIn 0.3s ease;">
        ✅ Quest "${quest.title}" claimed successfully! 
      </div>
    `;

    document.body.appendChild(successDiv);

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // Remove after 3 seconds
    setTimeout(() => {
      document.body.removeChild(successDiv);
      document.head.removeChild(style);
    }, 3000);
  }

  displayQuests() {
    const questList = document.getElementById('quest-list');
    if (!questList) {
      console.warn('Quest list element not found');
      return;
    }

    try {
      if (!this.quests || this.quests.length === 0) {
        questList.innerHTML = `
          <div class="no-quests-message" style="text-align: center; padding: 2rem; color: #94a3b8;">
            <p>No quests available yet. Connect your wallet to post new quests!</p>
          </div>
        `;
        return;
      }

      const questsHTML = this.quests.map(quest => {
        // Sanitize quest data
        const safeTitle = this.escapeHtml(quest.title || 'Untitled Quest');
        const safeDescription = quest.description ? this.escapeHtml(quest.description) : '';
        const safeReward = parseFloat(quest.reward) || 0;
        const questId = quest.id || Date.now();

        return `
          <div class="quest-item" data-quest-id="${questId}">
            <h3 class="quest-title">${safeTitle}</h3>
            ${safeDescription ? `<p class="quest-description">${safeDescription}</p>` : ''}
            <div class="quest-footer">
              <span class="quest-reward-text">
                Reward: <span class="quest-reward-amount">${safeReward.toFixed(4)} ETH</span>
              </span>
              <button 
                class="quest-claim-btn" 
                onclick="questManager.claimQuest('${questId}')"
                ${quest.status === 'claimed' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
              >
                ${quest.status === 'claimed' ? 'Claimed ✓' : 'Claim Quest'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      questList.innerHTML = questsHTML;

    } catch (error) {
      console.error('Error displaying quests:', error);
      questList.innerHTML = `
        <div class="error-message" style="text-align: center; padding: 2rem; color: #ef4444;">
          <p>Error loading quests. Please refresh the page.</p>
        </div>
      `;
    }
  }

  // HTML sanitization helper
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Default quests data
window.defaultQuests = [
  {
    id: 1,
    title: "🐦 Create Viral Twitter Thread About DeFi",
    description: "Write an engaging 10-tweet thread explaining DeFi concepts to newcomers. Must include @FluxoraHQ mention, receive 50+ retweets, and demonstrate clear understanding of yield farming, liquidity pools, and impermanent loss. Thread should be educational yet accessible.",
    reward: "0.025",
    status: "open",
    category: "Content Creation",
    difficulty: "Medium",
    timeEstimate: "2-3 hours"
  },
  {
    id: 2,
    title: "🔍 Security Audit: Smart Contract Review",
    description: "Conduct thorough security analysis of our upcoming staking contract. Identify potential vulnerabilities, gas optimization opportunities, and suggest improvements. Detailed report required with severity classifications and recommended fixes.",
    reward: "0.15",
    status: "open",
    category: "Bug Bounty",
    difficulty: "Expert",
    timeEstimate: "8-12 hours"
  },
  {
    id: 3,
    title: "🎨 Design Fluxora Mobile App UI/UX",
    description: "Create complete mobile app design mockups including onboarding flow, quest browsing, wallet integration, and reward tracking. Deliver Figma files with interactive prototypes, design system, and user journey documentation.",
    reward: "0.08",
    status: "open",
    category: "Design",
    difficulty: "Advanced",
    timeEstimate: "15-20 hours"
  },
  {
    id: 4,
    title: "📊 DeFi Protocol Comparative Analysis",
    description: "Research and compare top 10 DeFi lending protocols. Analyze TVL trends, interest rates, token economics, governance models, and security track records. Create comprehensive report with investment recommendations and risk assessments.",
    reward: "0.04",
    status: "open",
    category: "Research",
    difficulty: "Medium",
    timeEstimate: "6-8 hours"
  },
  {
    id: 5,
    title: "🎥 Fluxora Tutorial Video Series",
    description: "Produce 5-part video tutorial series covering: wallet connection, quest discovery, completion verification, reward claiming, and FLUX token staking. Videos should be 3-5 minutes each, professionally edited with clear narration.",
    reward: "0.12",
    status: "open",
    category: "Content Creation",
    difficulty: "Advanced",
    timeEstimate: "20-25 hours"
  },
  {
    id: 6,
    title: "🤝 Community Ambassador Program",
    description: "Become a Fluxora ambassador! Moderate our Discord server, onboard 25+ new users, organize weekly AMA sessions, and create engagement initiatives. 30-day commitment with performance bonuses available.",
    reward: "0.06",
    status: "open",
    category: "Community",
    difficulty: "Medium",
    timeEstimate: "Ongoing"
  },
  {
    id: 7,
    title: "⚡ Lightning-Fast Bug Hunt",
    description: "Quick bug bounty! Find and report any UI bugs, broken links, mobile responsiveness issues, or performance problems on our platform. First 10 valid reports get rewarded. Include screenshots and reproduction steps.",
    reward: "0.008",
    status: "open",
    category: "Bug Bounty",
    difficulty: "Easy",
    timeEstimate: "30-60 minutes"
  },
  {
    id: 8,
    title: "💻 Build Fluxora Analytics Dashboard",
    description: "Develop a real-time analytics dashboard showing platform statistics, user activity, quest completion rates, and reward distributions. Use React/Vue.js with Web3 integration. Include charts, filters, and export functionality.",
    reward: "0.25",
    status: "open",
    category: "Development",
    difficulty: "Expert",
    timeEstimate: "40-50 hours"
  }
];

// Export for global use
window.PostQuestForm = PostQuestForm;
window.QuestManager = QuestManager;
