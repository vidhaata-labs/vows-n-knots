import unittest
from unittest import mock

from vows_n_knots.adapters import model as model_module
from vows_n_knots.adapters.model import create_chat_model

ENV = {"NVIDIA_API_KEY": "k"}


class CreateChatModelTests(unittest.TestCase):
    def setUp(self):
        model_module._MODELS.clear()
        self.addCleanup(model_module._MODELS.clear)

    def test_passes_budget_and_timeout_to_builder(self):
        with mock.patch.object(model_module, "_build_chat_model") as build:
            create_chat_model(provider="nvidia", model="x", env=ENV,
                              max_output_tokens=8192, timeout=300)
        build.assert_called_once_with("nvidia", "x", max_output_tokens=8192, timeout=300)

    def test_different_settings_build_a_second_model(self):
        with mock.patch.object(model_module, "_build_chat_model",
                               side_effect=lambda *a, **k: object()) as build:
            first = create_chat_model(provider="nvidia", model="x", env=ENV)
            second = create_chat_model(provider="nvidia", model="x", env=ENV,
                                       max_output_tokens=8192, timeout=300)
            again = create_chat_model(provider="nvidia", model="x", env=ENV,
                                      max_output_tokens=8192, timeout=300)
        self.assertEqual(build.call_count, 2)
        self.assertIsNot(first, second)
        self.assertIs(second, again)

    def test_init_chat_model_gets_kwargs_only_when_set(self):
        with mock.patch("langchain.chat_models.init_chat_model") as init:
            model_module._build_chat_model("nvidia", "x")
            init.assert_called_with(model_provider="nvidia", model="x")
            model_module._build_chat_model("nvidia", "x", max_output_tokens=8192, timeout=300)
            init.assert_called_with(model_provider="nvidia", model="x",
                                    max_tokens=8192, timeout=300)


if __name__ == "__main__":
    unittest.main()
