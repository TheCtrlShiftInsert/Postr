/**
 * Native HTML Emoji Picker for Postr
 * Simple grid-based emoji selector
 */

const EmojiPicker = {
  // Common emojis organized by category
  EMOJIS: {
    smileys: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬'],
    gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    objects: ['💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸', '🎉', '✨', '🔥', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️'],
    nature: ['🌟', '⭐', '✨', '⚡', '🔥', '💧', '❄️', '🌈', '☀️', '🌤️', '⛅', '🌦️', '☁️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '🌬️', '💨', '🌪️', '🌫️', '🌊'],
    activities: ['🎵', '🎶', '🎼', '🎹', '🥁', '🎸', '🎺', '🎷', '🎻', '🎲', '🎯', '🎳', '🎮', '🎰', '🎱', '🏓', '🏸', '🥅', '⛳', '⛸️', '🎣', '🤿', '🎽', '🛹', '🛷', '⛷️', '🏂', '🏋️', '🤼', '🤽', '🤾', '🌐', '🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞', '⭐', '🌟', '🌠', '🌌', '☁️', '⛅', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', '🌬️', '🌀', '🌈', '🌂', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '🔥', '💧', '🌊']
  },

  /**
   * Create emoji picker element
   */
  create(container, onSelect) {
    const picker = document.createElement('div');
    picker.className = 'emoji-picker';
    picker.style.display = 'none';

    // Create tabs
    const tabs = document.createElement('div');
    tabs.className = 'emoji-tabs';
    
    const categories = Object.keys(this.EMOJIS);
    categories.forEach((category, index) => {
      const tab = document.createElement('button');
      tab.className = 'emoji-tab' + (index === 0 ? ' active' : '');
      tab.textContent = this.getCategoryIcon(category);
      tab.title = category;
      tab.onclick = () => this.showCategory(picker, category);
      tabs.appendChild(tab);
    });

    picker.appendChild(tabs);

    // Create emoji grids for each category
    categories.forEach((category, index) => {
      const grid = document.createElement('div');
      grid.className = 'emoji-grid';
      grid.dataset.category = category;
      grid.style.display = index === 0 ? 'grid' : 'none';

      this.EMOJIS[category].forEach(emoji => {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn';
        btn.textContent = emoji;
        btn.onclick = () => {
          onSelect(emoji);
          picker.style.display = 'none';
        };
        grid.appendChild(btn);
      });

      picker.appendChild(grid);
    });

    container.appendChild(picker);

    return picker;
  },

  /**
   * Show specific category
   */
  showCategory(picker, category) {
    // Update tabs
    picker.querySelectorAll('.emoji-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.title === category) {
        tab.classList.add('active');
      }
    });

    // Show grid
    picker.querySelectorAll('.emoji-grid').forEach(grid => {
      grid.style.display = grid.dataset.category === category ? 'grid' : 'none';
    });
  },

  /**
   * Get icon for category
   */
  getCategoryIcon(category) {
    const icons = {
      smileys: '😊',
      gestures: '👋',
      objects: '📦',
      symbols: '❤️',
      nature: '🌿',
      activities: '⚽'
    };
    return icons[category] || '•';
  },

  /**
   * Toggle picker visibility
   */
  toggle(picker) {
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
  },

  /**
   * Close picker
   */
  close(picker) {
    picker.style.display = 'none';
  }
};

// Make available globally
if (typeof window !== 'undefined') {
  window.EmojiPicker = EmojiPicker;
}