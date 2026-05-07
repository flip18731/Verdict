/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/verdict.json`.
 */
export type Verdict = {
  "address": "5L1XQWLcmYuKVEx1B8igHJahzhhCroANStoP9WGg5EKV",
  "metadata": {
    "name": "verdict",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Verdict — arbitration & dispute resolution for AI-agent commerce on Solana"
  },
  "instructions": [
    {
      "name": "castVote",
      "discriminator": [
        20,
        212,
        15,
        189,
        69,
        180,
        69,
        151
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "juror",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute.escrow",
                "account": "dispute"
              }
            ]
          }
        },
        {
          "name": "vote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "choice",
          "type": {
            "defined": {
              "name": "disputeOutcome"
            }
          }
        }
      ]
    },
    {
      "name": "claimJurorReward",
      "discriminator": [
        220,
        82,
        126,
        176,
        119,
        103,
        33,
        25
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "juror",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          },
          "relations": [
            "vote"
          ]
        },
        {
          "name": "dispute",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute.escrow",
                "account": "dispute"
              }
            ]
          },
          "relations": [
            "vote"
          ]
        },
        {
          "name": "vote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "dispute"
              },
              {
                "kind": "account",
                "path": "juror"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializeEscrow",
      "discriminator": [
        243,
        160,
        77,
        153,
        11,
        92,
        48,
        209
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "merchant"
        },
        {
          "name": "mint"
        },
        {
          "name": "payerTokenAccount",
          "writable": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "payer"
              },
              {
                "kind": "arg",
                "path": "escrowId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "escrowId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "releaseAfter",
          "type": "i64"
        }
      ]
    },
    {
      "name": "raiseDispute",
      "discriminator": [
        41,
        243,
        1,
        51,
        150,
        95,
        246,
        73
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.payer",
                "account": "escrow"
              },
              {
                "kind": "account",
                "path": "escrow.escrow_id",
                "account": "escrow"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "evidenceUri",
          "type": "string"
        },
        {
          "name": "votingWindowSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "registerJuror",
      "discriminator": [
        116,
        81,
        98,
        42,
        220,
        219,
        2,
        141
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "juror",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  106,
                  117,
                  114,
                  111,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "releaseEscrow",
      "discriminator": [
        146,
        253,
        129,
        233,
        20,
        145,
        181,
        206
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true,
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.payer",
                "account": "escrow"
              },
              {
                "kind": "account",
                "path": "escrow.escrow_id",
                "account": "escrow"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          },
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "merchantTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "caller",
          "docs": [
            "The dispute payout's rent recipient. Must be the original escrow payer",
            "so account-close lamports flow back to the funder. Anyone can sign;",
            "economic incentive lives off-chain."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "escrow.payer",
                "account": "escrow"
              },
              {
                "kind": "account",
                "path": "escrow.escrow_id",
                "account": "escrow"
              }
            ]
          }
        },
        {
          "name": "dispute",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  105,
                  115,
                  112,
                  117,
                  116,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "escrow"
              }
            ]
          },
          "relations": [
            "escrow"
          ]
        },
        {
          "name": "payerTokenAccount",
          "writable": true
        },
        {
          "name": "merchantTokenAccount",
          "writable": true
        },
        {
          "name": "payerRentRecipient",
          "docs": [
            "payer so lamports return to who funded the escrow."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "dispute",
      "discriminator": [
        36,
        49,
        241,
        67,
        40,
        36,
        241,
        74
      ]
    },
    {
      "name": "escrow",
      "discriminator": [
        31,
        213,
        123,
        187,
        186,
        22,
        218,
        155
      ]
    },
    {
      "name": "juror",
      "discriminator": [
        209,
        201,
        239,
        217,
        237,
        84,
        189,
        152
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        96,
        91,
        104,
        57,
        145,
        35,
        172,
        155
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Escrow amount must be greater than zero."
    },
    {
      "code": 6001,
      "name": "unauthorized",
      "msg": "Caller is not authorized for this action."
    },
    {
      "code": 6002,
      "name": "escrowNotFunded",
      "msg": "Escrow is not in the Funded state."
    },
    {
      "code": 6003,
      "name": "escrowNotDisputed",
      "msg": "Escrow is not in the Disputed state."
    },
    {
      "code": 6004,
      "name": "disputeAlreadyExists",
      "msg": "Escrow already has an active dispute."
    },
    {
      "code": 6005,
      "name": "disputeAlreadyResolved",
      "msg": "Dispute has already been resolved."
    },
    {
      "code": 6006,
      "name": "votingEnded",
      "msg": "Voting window has already ended."
    },
    {
      "code": 6007,
      "name": "votingNotEnded",
      "msg": "Voting window has not ended yet, and the panel is not full."
    },
    {
      "code": 6008,
      "name": "jurorAlreadyVoted",
      "msg": "This juror has already voted on this dispute."
    },
    {
      "code": 6009,
      "name": "jurorInactive",
      "msg": "Juror account is not active."
    },
    {
      "code": 6010,
      "name": "evidenceUriTooLong",
      "msg": "Evidence URI exceeds the 256-byte maximum."
    },
    {
      "code": 6011,
      "name": "panelFull",
      "msg": "Dispute panel is already full (3 jurors)."
    },
    {
      "code": 6012,
      "name": "notASeatedJuror",
      "msg": "This wallet is not a seated juror for this dispute."
    }
  ],
  "types": [
    {
      "name": "dispute",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrow",
            "type": "pubkey"
          },
          {
            "name": "raisedBy",
            "type": "pubkey"
          },
          {
            "name": "evidenceUri",
            "type": "string"
          },
          {
            "name": "votingEndsAt",
            "type": "i64"
          },
          {
            "name": "votesForRefund",
            "type": "u32"
          },
          {
            "name": "votesForRelease",
            "type": "u32"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "disputeStatus"
              }
            }
          },
          {
            "name": "outcome",
            "type": {
              "option": {
                "defined": {
                  "name": "disputeOutcome"
                }
              }
            }
          },
          {
            "name": "jurorsSeated",
            "type": "u8"
          },
          {
            "name": "jurorsVoted",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "disputeOutcome",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "refund"
          },
          {
            "name": "release"
          }
        ]
      }
    },
    {
      "name": "disputeStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "resolved"
          }
        ]
      }
    },
    {
      "name": "escrow",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrowId",
            "type": "u64"
          },
          {
            "name": "payer",
            "type": "pubkey"
          },
          {
            "name": "merchant",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "escrowStatus"
              }
            }
          },
          {
            "name": "dispute",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "releaseAfter",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "escrowStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "funded"
          },
          {
            "name": "released"
          },
          {
            "name": "disputed"
          },
          {
            "name": "refunded"
          }
        ]
      }
    },
    {
      "name": "juror",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "reputation",
            "type": "u32"
          },
          {
            "name": "casesVoted",
            "type": "u32"
          },
          {
            "name": "isActive",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "vote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "dispute",
            "type": "pubkey"
          },
          {
            "name": "juror",
            "type": "pubkey"
          },
          {
            "name": "choice",
            "type": {
              "defined": {
                "name": "disputeOutcome"
              }
            }
          },
          {
            "name": "castAt",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
