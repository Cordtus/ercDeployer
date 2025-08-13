// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ERC20Token is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint8 private _decimals;
    bool public mintable;
    bool public burnable;
    bool public pausable;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals_,
        uint256 initialSupply,
        bool _mintable,
        bool _burnable,
        bool _pausable
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        mintable = _mintable;
        burnable = _burnable;
        pausable = _pausable;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        if (_mintable) {
            _grantRole(MINTER_ROLE, msg.sender);
        }
        
        if (_pausable) {
            _grantRole(PAUSER_ROLE, msg.sender);
        }

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) public {
        require(mintable, "ERC20Token: minting is disabled");
        require(hasRole(MINTER_ROLE, msg.sender), "ERC20Token: must have minter role to mint");
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        require(burnable, "ERC20Token: burning is disabled");
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        require(burnable, "ERC20Token: burning is disabled");
        uint256 currentAllowance = allowance(account, msg.sender);
        require(currentAllowance >= amount, "ERC20: burn amount exceeds allowance");
        
        unchecked {
            _approve(account, msg.sender, currentAllowance - amount);
        }
        _burn(account, amount);
    }

    function pause() public {
        require(pausable, "ERC20Token: pausing is disabled");
        require(hasRole(PAUSER_ROLE, msg.sender), "ERC20Token: must have pauser role to pause");
        _pause();
    }

    function unpause() public {
        require(pausable, "ERC20Token: pausing is disabled");
        require(hasRole(PAUSER_ROLE, msg.sender), "ERC20Token: must have pauser role to unpause");
        _unpause();
    }

    function paused() public view returns (bool) {
        if (!pausable) {
            return false;
        }
        return _paused;
    }

    // Internal state variables from OpenZeppelin Pausable
    bool private _paused;

    function _pause() internal {
        _paused = true;
        emit Paused(msg.sender);
    }

    function _unpause() internal {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
        require(!_paused, "ERC20Pausable: token transfer while paused");
    }

    // Events from OpenZeppelin Pausable
    event Paused(address account);
    event Unpaused(address account);
}