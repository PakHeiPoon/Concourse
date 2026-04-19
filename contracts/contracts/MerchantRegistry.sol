// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MerchantRegistry {
    struct MerchantIdentity {
        address owner;
        string  did;
        string  merchantType;
        string  profileHash;
        string  profileURI;
        string  skillEndpoint;
        uint256 registeredAt;
        uint256 updatedAt;
        bool    active;
    }

    mapping(string => MerchantIdentity) private merchants;
    mapping(string => string[]) private typeToDids;
    string[] private allDids;
    
    event MerchantRegistered(string indexed did, address indexed owner, string merchantType);
    event MerchantUpdated(string indexed did, address indexed owner);
    event MerchantDeactivated(string indexed did, address indexed owner);

    function register(
        string memory _did,
        string memory _merchantType,
        string memory _profileHash,
        string memory _profileURI,
        string memory _skillEndpoint
    ) external {
        require(merchants[_did].owner == address(0), "Merchant already registered");

        merchants[_did] = MerchantIdentity({
            owner: msg.sender,
            did: _did,
            merchantType: _merchantType,
            profileHash: _profileHash,
            profileURI: _profileURI,
            skillEndpoint: _skillEndpoint,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            active: true
        });

        typeToDids[_merchantType].push(_did);
        allDids.push(_did);

        emit MerchantRegistered(_did, msg.sender, _merchantType);
    }

    function getMerchant(string memory _did) external view returns (MerchantIdentity memory) {
        return merchants[_did];
    }

    function listByType(string memory _merchantType, uint256 offset, uint256 limit) external view returns (MerchantIdentity[] memory) {
        string[] memory dids = typeToDids[_merchantType];
        uint256 length = dids.length;
        if (offset >= length) {
            return new MerchantIdentity[](0);
        }
        uint256 end = offset + limit;
        if (end > length) {
            end = length;
        }
        uint256 resultLength = end - offset;
        MerchantIdentity[] memory result = new MerchantIdentity[](resultLength);
        for (uint256 i = 0; i < resultLength; i++) {
            result[i] = merchants[dids[offset + i]];
        }
        return result;
    }
}
