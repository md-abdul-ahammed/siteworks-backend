/**
 * Bank Validation Service
 * Validates bank details before GoCardless integration
 */
class BankValidationService {
  constructor() {
    // Bank code patterns for different countries
    this.bankCodePatterns = {
      'US': {
        pattern: /^\d{9}$/,
        description: '9-digit routing number',
        example: '021000021'
      },
      'CA': {
        pattern: /^\d{9}$/,
        description: '9-digit bank code',
        example: '021000021'
      },
      'GB': {
        pattern: /^\d{6}$/,
        description: '6-digit sort code',
        example: '123456'
      },
      'AU': {
        pattern: /^\d{6}$/,
        description: '6-digit BSB code',
        example: '123456'
      }
    };

    // Account number patterns
    this.accountNumberPatterns = {
      'US': {
        pattern: /^\d{4,17}$/,
        description: '4-17 digit account number',
        minLength: 4,
        maxLength: 17
      },
      'CA': {
        pattern: /^\d{7,12}$/,
        description: '7-12 digit account number',
        minLength: 7,
        maxLength: 12
      },
      'GB': {
        pattern: /^\d{8}$/,
        description: '8-digit account number',
        minLength: 8,
        maxLength: 8
      },
      'AU': {
        pattern: /^\d{6,9}$/,
        description: '6-9 digit account number',
        minLength: 6,
        maxLength: 9
      }
    };
  }

  /**
   * Validate bank details for a specific country
   * @param {Object} bankDetails - Bank details to validate
   * @param {string} bankDetails.bankCode - Bank code/routing number
   * @param {string} bankDetails.accountNumber - Account number
   * @param {string} bankDetails.accountHolderName - Account holder name
   * @param {string} bankDetails.accountType - Account type (checking/savings)
   * @param {string} countryCode - Country code
   * @returns {Object} Validation result
   */
  validateBankDetails(bankDetails, countryCode) {
    const errors = [];
    const warnings = [];
    const isValid = { bankCode: true, accountNumber: true, accountHolderName: true, accountType: true };

    // Validate bank code
    if (!bankDetails.bankCode) {
      errors.push('Bank code is required');
      isValid.bankCode = false;
    } else {
      const bankCodePattern = this.bankCodePatterns[countryCode];
      if (bankCodePattern) {
        if (!bankCodePattern.pattern.test(bankDetails.bankCode)) {
          errors.push(`Bank code must be ${bankCodePattern.description} (e.g., ${bankCodePattern.example})`);
          isValid.bankCode = false;
        }
      } else {
        // For countries without specific patterns, just check if it's not empty
        if (bankDetails.bankCode.length < 3) {
          errors.push('Bank code must be at least 3 characters');
          isValid.bankCode = false;
        }
      }
    }

    // Validate account number
    if (!bankDetails.accountNumber) {
      errors.push('Account number is required');
      isValid.accountNumber = false;
    } else {
      const accountPattern = this.accountNumberPatterns[countryCode];
      if (accountPattern) {
        if (!accountPattern.pattern.test(bankDetails.accountNumber)) {
          errors.push(`Account number must be ${accountPattern.description}`);
          isValid.accountNumber = false;
        }
        if (bankDetails.accountNumber.length < accountPattern.minLength) {
          errors.push(`Account number must be at least ${accountPattern.minLength} digits`);
          isValid.accountNumber = false;
        }
        if (bankDetails.accountNumber.length > accountPattern.maxLength) {
          errors.push(`Account number must be no more than ${accountPattern.maxLength} digits`);
          isValid.accountNumber = false;
        }
      } else {
        // For countries without specific patterns
        if (bankDetails.accountNumber.length < 4) {
          errors.push('Account number must be at least 4 digits');
          isValid.accountNumber = false;
        }
      }
    }

    // Validate account holder name
    if (!bankDetails.accountHolderName) {
      errors.push('Account holder name is required');
      isValid.accountHolderName = false;
    } else {
      if (bankDetails.accountHolderName.length < 2) {
        errors.push('Account holder name must be at least 2 characters');
        isValid.accountHolderName = false;
      }
      if (bankDetails.accountHolderName.length > 100) {
        errors.push('Account holder name must be no more than 100 characters');
        isValid.accountHolderName = false;
      }
      // Check for valid characters (letters, spaces, hyphens, apostrophes)
      if (!/^[a-zA-Z\s\-']+$/.test(bankDetails.accountHolderName)) {
        errors.push('Account holder name can only contain letters, spaces, hyphens, and apostrophes');
        isValid.accountHolderName = false;
      }
    }

    // Validate account type
    if (!bankDetails.accountType) {
      errors.push('Account type is required');
      isValid.accountType = false;
    } else {
      const validTypes = ['checking', 'savings'];
      if (!validTypes.includes(bankDetails.accountType.toLowerCase())) {
        errors.push('Account type must be either "checking" or "savings"');
        isValid.accountType = false;
      }
    }

    // Add warnings for potential issues
    if (bankDetails.accountNumber && bankDetails.accountNumber.length < 6) {
      warnings.push('Short account numbers may cause issues with some banks');
    }

    if (bankDetails.accountHolderName && bankDetails.accountHolderName.length > 50) {
      warnings.push('Long account holder names may be truncated by some banks');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fieldValidation: isValid,
      countryCode,
      suggestions: this.getSuggestions(countryCode)
    };
  }

  /**
   * Get suggestions for a specific country
   * @param {string} countryCode - Country code
   * @returns {Object} Suggestions for the country
   */
  getSuggestions(countryCode) {
    const suggestions = {
      'US': {
        bankCodeHelp: 'Find your routing number on the bottom of your checks or contact your bank',
        accountNumberHelp: 'Your account number is usually 8-12 digits long',
        note: 'US banks use 9-digit routing numbers and variable-length account numbers'
      },
      'CA': {
        bankCodeHelp: 'Your bank code is 9 digits and can be found on your checks or bank statement',
        accountNumberHelp: 'Canadian account numbers are typically 7-12 digits',
        note: 'Canadian banks use 9-digit bank codes'
      },
      'GB': {
        bankCodeHelp: 'Your sort code is 6 digits and can be found on your bank card or statement',
        accountNumberHelp: 'UK account numbers are exactly 8 digits',
        note: 'UK banks use 6-digit sort codes and 8-digit account numbers'
      },
      'AU': {
        bankCodeHelp: 'Your BSB code is 6 digits and can be found on your bank statement',
        accountNumberHelp: 'Australian account numbers are 6-9 digits',
        note: 'Australian banks use 6-digit BSB codes'
      }
    };

    return suggestions[countryCode] || {
      bankCodeHelp: 'Contact your bank for the correct bank code format',
      accountNumberHelp: 'Your account number can be found on your bank statement',
      note: 'Please ensure your bank details match your bank\'s requirements'
    };
  }

  /**
   * Format bank code for display
   * @param {string} bankCode - Bank code to format
   * @param {string} countryCode - Country code
   * @returns {string} Formatted bank code
   */
  formatBankCode(bankCode, countryCode) {
    if (!bankCode) return '';

    switch (countryCode) {
      case 'US':
        // Format as XXX-XXX-XXX
        return bankCode.replace(/(\d{3})(\d{3})(\d{3})/, '$1-$2-$3');
      case 'GB':
        // Format as XX-XX-XX
        return bankCode.replace(/(\d{2})(\d{2})(\d{2})/, '$1-$2-$3');
      case 'AU':
        // Format as XXX-XXX
        return bankCode.replace(/(\d{3})(\d{3})/, '$1-$2');
      default:
        return bankCode;
    }
  }

  /**
   * Mask account number for security
   * @param {string} accountNumber - Account number to mask
   * @returns {string} Masked account number
   */
  maskAccountNumber(accountNumber) {
    if (!accountNumber || accountNumber.length < 4) return accountNumber;
    return '****' + accountNumber.slice(-4);
  }
}

module.exports = BankValidationService; 